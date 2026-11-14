//! Whether GitHub has a newer DevAtlas release than the running build.
//!
//! Releases are tagged `v{version}-build.{n}` (see `.github/workflows/release.yml`), where `n`
//! is the CI run that built them. A build made on a developer's machine has no `n`.
//!
//! An update is installed from the release's `DevAtlas-Update-{tag}.gz` (the app, gzipped) only
//! after its minisign signature (`.gz.sig`, made by release.yml with `tauri signer`) checks out
//! against the public key built into the app, and names that same file: the signature's trusted
//! comment carries the signed file's name, so an old signed package can't pose as a newer tag.

use std::cmp::Ordering;
use std::future::Future;

use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use minisign_verify::{PublicKey, Signature};

use crate::discovery::{ReleaseSource, RepoRelease};

/// Largest update package accepted; the gzipped app is about 9 MB.
pub const MAX_PACKAGE_BYTES: usize = 64 * 1024 * 1024;
const MAX_SIGNATURE_BYTES: usize = 4 * 1024;

/// Port: fetches one file over https, refusing anything larger than `max_bytes`.
pub trait UpdateDownloader {
    type Error: std::fmt::Display;
    fn download(
        &self,
        url: &str,
        max_bytes: usize,
    ) -> impl Future<Output = Result<Vec<u8>, Self::Error>> + Send;
}

/// Port: puts a verified package (the gzipped app) in place of the installed app.
pub trait AppReplacer {
    type Error: std::fmt::Display;
    /// `version` is the new version, such as `0.1.1`, for the Windows app list.
    fn replace(
        &self,
        package: Vec<u8>,
        version: String,
    ) -> impl Future<Output = Result<(), Self::Error>> + Send;
}

#[derive(Debug, thiserror::Error)]
pub enum UpdateError<D, R> {
    #[error("The release {0} isn't a DevAtlas update.")]
    UnknownTag(String),
    #[error("Couldn't download the update: {0}")]
    Download(D),
    #[error("The update's signature didn't match, so it wasn't installed.")]
    BadSignature,
    #[error("Couldn't install the update: {0}")]
    Install(R),
}

/// The latest release of `releases_repo` (`owner/name`) when it is newer than the running
/// build, else `None`.
pub async fn newer_release<S: ReleaseSource>(
    source: &S,
    releases_repo: &str,
    version: &str,
    build: Option<u64>,
) -> Result<Option<RepoRelease>, S::Error> {
    let latest = source.latest_release(releases_repo).await?;
    Ok(latest.filter(|release| is_newer(&release.tag, version, build)))
}

fn is_newer(tag: &str, version: &str, build: Option<u64>) -> bool {
    let Some((latest_version, latest_build)) = parse_tag(tag) else {
        return false;
    };
    let Some(current_version) = parse_version(version) else {
        return false;
    };
    match latest_version.cmp(&current_version) {
        Ordering::Greater => true,
        Ordering::Less => false,
        // A local build has no number: it counts as the newest build of its version.
        Ordering::Equal => {
            matches!((latest_build, build), (Some(latest), Some(current)) if latest > current)
        }
    }
}

/// `v0.1.0-build.23` → `([0, 1, 0], Some(23))`; `v0.2.0` → `([0, 2, 0], None)`.
fn parse_tag(tag: &str) -> Option<(Vec<u64>, Option<u64>)> {
    let tag = tag.strip_prefix('v').unwrap_or(tag);
    match tag.split_once("-build.") {
        Some((version, build)) => Some((parse_version(version)?, Some(build.parse().ok()?))),
        None => Some((parse_version(tag)?, None)),
    }
}

fn parse_version(version: &str) -> Option<Vec<u64>> {
    version.split('.').map(|part| part.parse().ok()).collect()
}

/// Where release.yml attaches the update package. `tag` has passed `parse_tag`, so it holds
/// only digits, dots and `v`/`-build.`: nothing that can change the path.
fn package_url(releases_repo: &str, tag: &str) -> String {
    format!(
        "https://github.com/{releases_repo}/releases/download/{tag}/{}",
        package_name(tag)
    )
}

fn package_name(tag: &str) -> String {
    format!("DevAtlas-Update-{tag}.gz")
}

/// Downloads release `tag`'s update package, checks its signature against `public_key` (the
/// base64 key file `tauri signer generate` writes) and installs it.
pub async fn install_update<D: UpdateDownloader, R: AppReplacer>(
    downloader: &D,
    replacer: &R,
    public_key: &str,
    releases_repo: &str,
    tag: &str,
) -> Result<(), UpdateError<D::Error, R::Error>> {
    let Some((version, _)) = parse_tag(tag) else {
        return Err(UpdateError::UnknownTag(tag.to_owned()));
    };
    let url = package_url(releases_repo, tag);
    let package = downloader
        .download(&url, MAX_PACKAGE_BYTES)
        .await
        .map_err(UpdateError::Download)?;
    let signature = downloader
        .download(&format!("{url}.sig"), MAX_SIGNATURE_BYTES)
        .await
        .map_err(UpdateError::Download)?;
    if !is_signed_by(public_key, &package_name(tag), &package, &signature) {
        return Err(UpdateError::BadSignature);
    }
    let version = version
        .iter()
        .map(u64::to_string)
        .collect::<Vec<_>>()
        .join(".");
    replacer
        .replace(package, version)
        .await
        .map_err(UpdateError::Install)
}

/// Whether `signature` (a `.sig` file from `tauri signer sign`) signs `data` with `public_key`,
/// as the file `file_name`. Both are base64-wrapped minisign text, the format `tauri signer`
/// writes; its trusted comment, covered by the signature, reads `timestamp:…\tfile:{name}`.
pub fn is_signed_by(public_key: &str, file_name: &str, data: &[u8], signature: &[u8]) -> bool {
    let signature = unwrap_base64(signature).and_then(|text| Signature::decode(&text).ok());
    let (Some(key), Some(signature)) = (parse_public_key(public_key), signature) else {
        return false;
    };
    let names_file = signature
        .trusted_comment()
        .split('\t')
        .any(|field| field.strip_prefix("file:") == Some(file_name));
    names_file && key.verify(data, &signature, false).is_ok()
}

/// Whether `public_key` is a key file `tauri signer generate` wrote.
pub fn is_public_key(public_key: &str) -> bool {
    parse_public_key(public_key).is_some()
}

fn parse_public_key(public_key: &str) -> Option<PublicKey> {
    PublicKey::decode(&unwrap_base64(public_key.as_bytes())?).ok()
}

fn unwrap_base64(text: &[u8]) -> Option<String> {
    String::from_utf8(BASE64.decode(text.trim_ascii()).ok()?).ok()
}

#[cfg(test)]
mod tests {
    use std::convert::Infallible;
    use std::pin::pin;
    use std::sync::Mutex;
    use std::task::{Context, Poll, Waker};

    use super::*;
    use crate::discovery::{GithubRepo, RepoSource};

    struct FakeReleases {
        latest: Option<RepoRelease>,
        asked_for: Mutex<Vec<String>>,
    }

    impl FakeReleases {
        fn with_tag(tag: &str) -> Self {
            Self {
                latest: Some(RepoRelease {
                    tag: tag.to_owned(),
                    name: Some(format!("DevAtlas {tag}")),
                    url: format!("https://github.com/owner/devatlas/releases/tag/{tag}"),
                    published_at: "2026-11-14T10:00:00Z".to_owned(),
                }),
                asked_for: Mutex::default(),
            }
        }
    }

    impl RepoSource for FakeReleases {
        type Error = Infallible;

        async fn repo(&self, _: &str) -> Result<GithubRepo, Infallible> {
            unreachable!("an update check only reads releases")
        }
    }

    impl ReleaseSource for FakeReleases {
        async fn latest_release(&self, full_name: &str) -> Result<Option<RepoRelease>, Infallible> {
            self.asked_for.lock().unwrap().push(full_name.to_owned());
            Ok(self.latest.clone())
        }
    }

    /// The fake resolves immediately, so a single poll completes the future.
    fn block_on<F: Future>(future: F) -> F::Output {
        let mut future = pin!(future);
        let mut cx = Context::from_waker(Waker::noop());
        loop {
            if let Poll::Ready(output) = future.as_mut().poll(&mut cx) {
                return output;
            }
        }
    }

    fn check(tag: &str, version: &str, build: Option<u64>) -> Option<RepoRelease> {
        let source = FakeReleases::with_tag(tag);
        let Ok(found) = block_on(newer_release(&source, "owner/devatlas", version, build));
        assert_eq!(*source.asked_for.lock().unwrap(), ["owner/devatlas"]);
        found
    }

    #[test]
    fn a_later_build_of_the_same_version_is_an_update() {
        let update = check("v0.1.0-build.24", "0.1.0", Some(23));

        assert_eq!(
            update.map(|release| release.tag).as_deref(),
            Some("v0.1.0-build.24")
        );
    }

    #[test]
    fn the_running_build_or_an_older_one_is_not_an_update() {
        assert_eq!(check("v0.1.0-build.23", "0.1.0", Some(23)), None);
        assert_eq!(check("v0.1.0-build.9", "0.1.0", Some(23)), None);
    }

    #[test]
    fn versions_compare_as_numbers_before_builds() {
        assert!(check("v0.1.10-build.1", "0.1.9", Some(50)).is_some());
        assert!(check("v0.2.0", "0.1.0", Some(23)).is_some());
        assert_eq!(check("v0.1.0-build.99", "0.2.0", Some(1)), None);
    }

    #[test]
    fn a_local_build_only_updates_to_a_newer_version() {
        assert_eq!(check("v0.1.0-build.24", "0.1.0", None), None);
        assert!(check("v0.1.1-build.1", "0.1.0", None).is_some());
    }

    #[test]
    fn an_unrecognised_tag_is_never_offered() {
        assert_eq!(check("nightly", "0.1.0", Some(1)), None);
        assert_eq!(check("v0.1.0-build.x", "0.1.0", Some(1)), None);
    }

    /// A throwaway key pair made with `tauri signer generate`; DATA was signed with
    /// `tauri signer sign` as a file named NAME. OTHER_KEY is a different key.
    const TEST_KEY: &str = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDI5MTQ0NzFGMTYyN0IxQTYKUldTbXNTY1dIMGNVS1ZjbDVOYzBmQ1lWUGp6WFdPeE9nbURRU292U2J3eGVQWG9NMjl2QnVlejIK";
    const OTHER_KEY: &str = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEVCMjE5MTdEQ0UwNERGMzMKUldRejN3VE9mWkVoNjRtQWFuTTI5N094OEhyZEZ5b0huTTA3dUNwNlY4WjkvMEVZTlVHTlNMK1QK";
    const DATA: &[u8] = b"devatlas update fixture";
    const NAME: &str = "DevAtlas-Update-v0.1.1-build.24.gz";
    const SIGNATURE: &[u8] = b"dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVTbXNTY1dIMGNVS1p2U09TVjQ5ZGNweTlLQXlTZ2QzYVpFd2lrQnFGTjVuMElGa2ZQa296cTdDMHd1d1p0bUI4V1E0dVMvS2ZYL2dXY0UwZWltMG1kaDN4bzBlYUFoYVFZPQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzk0NjI3ODUyCWZpbGU6RGV2QXRsYXMtVXBkYXRlLXYwLjEuMS1idWlsZC4yNC5negpyQ21MVzFYcGZGdFpqbi9KSGtKRFJ6a3M3V3l4bUttUEFJSVc2bmoyRGY0cUJWd3pkOGY3RnRVeUFnanp1blBmMkJGb0lwaU1iSUxqOWpaZ1JkcUFBQT09Cg==";

    #[test]
    fn only_the_matching_key_and_untouched_data_pass_the_signature_check() {
        assert!(is_signed_by(TEST_KEY, NAME, DATA, SIGNATURE));
        assert!(!is_signed_by(
            TEST_KEY,
            NAME,
            b"devatlas update fixturE",
            SIGNATURE
        ));
        assert!(!is_signed_by(OTHER_KEY, NAME, DATA, SIGNATURE));
        assert!(!is_signed_by(TEST_KEY, NAME, DATA, b"not a signature"));
        assert!(!is_signed_by("not a key", NAME, DATA, SIGNATURE));
    }

    #[test]
    fn a_signed_package_cannot_pose_as_another_release() {
        assert!(!is_signed_by(
            TEST_KEY,
            "DevAtlas-Update-v9.0.0.gz",
            DATA,
            SIGNATURE
        ));
        assert!(!is_signed_by(
            TEST_KEY,
            "DevAtlas-Update-v0.1.1-build.2",
            DATA,
            SIGNATURE
        ));
    }

    #[derive(Default)]
    struct FakeDownloads {
        package: Vec<u8>,
        signature: Vec<u8>,
        fetched: Mutex<Vec<String>>,
    }

    impl UpdateDownloader for FakeDownloads {
        type Error = Infallible;

        async fn download(&self, url: &str, _: usize) -> Result<Vec<u8>, Infallible> {
            self.fetched.lock().unwrap().push(url.to_owned());
            Ok(if url.ends_with(".sig") {
                self.signature.clone()
            } else {
                self.package.clone()
            })
        }
    }

    #[derive(Default)]
    struct FakeApp {
        installed: Mutex<Option<(Vec<u8>, String)>>,
    }

    impl AppReplacer for FakeApp {
        type Error = Infallible;

        async fn replace(&self, package: Vec<u8>, version: String) -> Result<(), Infallible> {
            *self.installed.lock().unwrap() = Some((package, version));
            Ok(())
        }
    }

    fn signed_downloads() -> FakeDownloads {
        FakeDownloads {
            package: DATA.to_vec(),
            signature: SIGNATURE.to_vec(),
            ..FakeDownloads::default()
        }
    }

    fn install(
        downloads: &FakeDownloads,
        app: &FakeApp,
        tag: &str,
    ) -> Result<(), UpdateError<Infallible, Infallible>> {
        block_on(install_update(
            downloads,
            app,
            TEST_KEY,
            "owner/devatlas",
            tag,
        ))
    }

    #[test]
    fn installs_a_signed_package_from_the_release() {
        let downloads = signed_downloads();
        let app = FakeApp::default();

        assert!(install(&downloads, &app, "v0.1.1-build.24").is_ok());

        let package = "https://github.com/owner/devatlas/releases/download/v0.1.1-build.24/DevAtlas-Update-v0.1.1-build.24.gz";
        assert_eq!(
            *downloads.fetched.lock().unwrap(),
            [package.to_owned(), format!("{package}.sig")]
        );
        assert_eq!(
            *app.installed.lock().unwrap(),
            Some((DATA.to_vec(), "0.1.1".to_owned()))
        );
    }

    #[test]
    fn an_older_signed_package_is_refused_under_a_newer_tag() {
        let downloads = signed_downloads();
        let app = FakeApp::default();

        let result = install(&downloads, &app, "v9.0.0-build.99");

        assert!(matches!(result, Err(UpdateError::BadSignature)));
        assert_eq!(*app.installed.lock().unwrap(), None);
    }

    #[test]
    fn a_package_the_key_did_not_sign_is_never_installed() {
        let downloads = FakeDownloads {
            package: b"something else".to_vec(),
            ..signed_downloads()
        };
        let app = FakeApp::default();

        let result = install(&downloads, &app, "v0.1.1-build.24");

        assert!(matches!(result, Err(UpdateError::BadSignature)));
        assert_eq!(*app.installed.lock().unwrap(), None);
    }

    #[test]
    fn a_tag_that_is_not_a_release_name_downloads_nothing() {
        let downloads = signed_downloads();
        let app = FakeApp::default();

        let result = install(&downloads, &app, "../../evil");

        assert!(matches!(result, Err(UpdateError::UnknownTag(_))));
        assert!(downloads.fetched.lock().unwrap().is_empty());
    }

    #[test]
    fn no_release_means_no_update() {
        let source = FakeReleases {
            latest: None,
            asked_for: Mutex::default(),
        };

        let Ok(found) = block_on(newer_release(&source, "owner/devatlas", "0.1.0", Some(1)));

        assert_eq!(found, None);
    }
}
