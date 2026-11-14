//! Self-update: downloads release files from GitHub and swaps a new `DevAtlas.exe` into the
//! folder DevAtlas Setup installed. Signatures are checked by the application layer first.

use std::fs::{self, File};
use std::io::{self, Read};
use std::path::{Path, PathBuf};
use std::time::Duration;

use devatlas_application::updates::{AppReplacer, UpdateDownloader};
use flate2::read::GzDecoder;
use reqwest::redirect::{Attempt, Policy};

use crate::install_location;

const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(5 * 60);
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const MAX_REDIRECTS: usize = 5;
/// Release downloads redirect from github.com to this host.
const DOWNLOAD_HOSTS: [&str; 3] = [
    "github.com",
    "release-assets.githubusercontent.com",
    "objects.githubusercontent.com",
];
/// Largest app the package may unpack to; the app is about 25 MB.
const MAX_APP_BYTES: u64 = 256 * 1024 * 1024;
const USER_AGENT: &str = concat!("DevAtlas/", env!("CARGO_PKG_VERSION"));

#[derive(Debug, thiserror::Error)]
pub enum DownloadError {
    #[error("This release has no update package. Download DevAtlas Setup from the release page.")]
    Missing,
    #[error("GitHub answered with status {0}.")]
    Status(u16),
    #[error("GitHub could not be reached: {0}")]
    Http(#[from] reqwest::Error),
    #[error("The download was larger than expected.")]
    TooLarge,
    #[error("Updates only download from GitHub.")]
    NotGithub,
}

fn is_download_host(url: &reqwest::Url) -> bool {
    url.scheme() == "https"
        && url
            .host_str()
            .is_some_and(|host| DOWNLOAD_HOSTS.contains(&host))
}

/// Follows GitHub's redirect to its download host, and nowhere else.
fn follow_github(attempt: Attempt<'_>) -> reqwest::redirect::Action {
    if attempt.previous().len() < MAX_REDIRECTS && is_download_host(attempt.url()) {
        attempt.follow()
    } else {
        attempt.stop()
    }
}

pub struct UpdateDownloads {
    client: reqwest::Client,
}

impl UpdateDownloads {
    pub fn new() -> Result<Self, DownloadError> {
        let client = reqwest::Client::builder()
            .user_agent(USER_AGENT)
            .timeout(DOWNLOAD_TIMEOUT)
            .connect_timeout(CONNECT_TIMEOUT)
            .redirect(Policy::custom(follow_github))
            .build()?;
        Ok(Self { client })
    }
}

impl UpdateDownloader for UpdateDownloads {
    type Error = DownloadError;

    async fn download(&self, url: &str, max_bytes: usize) -> Result<Vec<u8>, DownloadError> {
        let url = reqwest::Url::parse(url).map_err(|_| DownloadError::NotGithub)?;
        if !is_download_host(&url) {
            return Err(DownloadError::NotGithub);
        }
        let mut response = self.client.get(url).send().await?;
        match response.status() {
            status if status.is_success() => {}
            reqwest::StatusCode::NOT_FOUND => return Err(DownloadError::Missing),
            status => return Err(DownloadError::Status(status.as_u16())),
        }
        let mut body = Vec::new();
        while let Some(chunk) = response.chunk().await? {
            body.extend_from_slice(&chunk);
            if body.len() > max_bytes {
                return Err(DownloadError::TooLarge);
            }
        }
        Ok(body)
    }
}

/// The installed `DevAtlas.exe` that an update replaces.
pub struct InstalledApp {
    exe: PathBuf,
}

impl InstalledApp {
    /// The running app, when it is the copy DevAtlas Setup installed: a development build or a
    /// copy run from elsewhere is never replaced.
    pub fn running() -> Option<Self> {
        let installed = fs::canonicalize(install_location::installed_app()?).ok()?;
        let running = fs::canonicalize(std::env::current_exe().ok()?).ok()?;
        (installed == running).then_some(Self { exe: installed })
    }

    pub fn exe(&self) -> &Path {
        &self.exe
    }

    /// Deletes the copy the last update set aside. It may still be running right after an
    /// update; then it stays until the next start.
    pub fn remove_previous(&self) {
        let previous = aside(&self.exe, "old");
        if let Err(error) = fs::remove_file(&previous)
            && error.kind() != io::ErrorKind::NotFound
        {
            tracing::debug!(%error, "the previous version is still in use");
        }
    }
}

impl AppReplacer for InstalledApp {
    type Error = io::Error;

    /// Unpacking and renaming block, so they run on a blocking thread.
    async fn replace(&self, package: Vec<u8>, version: String) -> io::Result<()> {
        let exe = self.exe.clone();
        tokio::task::spawn_blocking(move || {
            replace_exe(&exe, &package)?;
            if let Err(error) = install_location::set_installed_version(&version) {
                // The app is updated; only the version shown in Windows' app list is stale.
                tracing::warn!(%error, "could not record the new version in the app list");
            }
            Ok(())
        })
        .await
        .map_err(io::Error::other)?
    }
}

/// `DevAtlas.exe` → `DevAtlas.exe.{suffix}`, next to it.
fn aside(exe: &Path, suffix: &str) -> PathBuf {
    let mut name = exe.file_name().unwrap_or_default().to_owned();
    name.push(format!(".{suffix}"));
    exe.with_file_name(name)
}

/// Unpacks the gzipped app next to `exe`, then swaps it in. Windows lets a running program be
/// renamed but not overwritten, so the running copy moves aside to `.old` first. Any failure
/// leaves the original in place.
fn replace_exe(exe: &Path, package: &[u8]) -> io::Result<()> {
    let new = aside(exe, "new");
    let old = aside(exe, "old");
    let unpacked = unpack(package, &new).and_then(|()| match fs::remove_file(&old) {
        Err(error) if error.kind() != io::ErrorKind::NotFound => Err(error),
        _ => fs::rename(exe, &old),
    });
    if let Err(error) = unpacked {
        let _ = fs::remove_file(&new);
        return Err(error);
    }
    if let Err(error) = fs::rename(&new, exe) {
        if let Err(restore) = fs::rename(&old, exe) {
            // DevAtlas.exe is now missing; running DevAtlas Setup again repairs it.
            tracing::error!(%error, %restore, "could not put the previous version back");
        }
        let _ = fs::remove_file(&new);
        return Err(error);
    }
    Ok(())
}

fn unpack(package: &[u8], to: &Path) -> io::Result<()> {
    let mut file = File::create(to)?;
    let written = io::copy(
        &mut GzDecoder::new(package).take(MAX_APP_BYTES + 1),
        &mut file,
    )?;
    if written == 0 || written > MAX_APP_BYTES {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "the update package is empty or too large",
        ));
    }
    file.sync_all()
}

#[cfg(test)]
mod tests {
    use std::io::Write;

    use flate2::Compression;
    use flate2::write::GzEncoder;

    use super::*;

    fn gzip(bytes: &[u8]) -> Vec<u8> {
        let mut encoder = GzEncoder::new(Vec::new(), Compression::fast());
        encoder.write_all(bytes).unwrap();
        encoder.finish().unwrap()
    }

    fn installed(test: &str) -> (PathBuf, PathBuf) {
        let dir =
            std::env::temp_dir().join(format!("devatlas-update-{test}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let exe = dir.join("DevAtlas.exe");
        fs::write(&exe, b"old app").unwrap();
        (dir, exe)
    }

    #[test]
    fn swaps_in_the_new_app_and_keeps_the_old_one_aside() {
        let (dir, exe) = installed("swap");
        fs::write(dir.join("DevAtlas.exe.old"), b"an older update").unwrap();

        replace_exe(&exe, &gzip(b"new app")).unwrap();

        assert_eq!(fs::read(&exe).unwrap(), b"new app");
        assert_eq!(fs::read(dir.join("DevAtlas.exe.old")).unwrap(), b"old app");
        assert!(!dir.join("DevAtlas.exe.new").exists());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn a_broken_package_leaves_the_installed_app_alone() {
        let (dir, exe) = installed("broken");

        assert!(replace_exe(&exe, b"not gzip").is_err());
        assert!(replace_exe(&exe, &gzip(b"")).is_err());

        assert_eq!(fs::read(&exe).unwrap(), b"old app");
        assert!(!dir.join("DevAtlas.exe.new").exists());
        assert!(!dir.join("DevAtlas.exe.old").exists());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn downloads_only_from_github_over_https() {
        let allowed = |url: &str| is_download_host(&reqwest::Url::parse(url).unwrap());

        assert!(allowed("https://github.com/o/r/releases/download/v1/a.gz"));
        assert!(allowed("https://release-assets.githubusercontent.com/x"));
        assert!(!allowed("http://github.com/o/r"));
        assert!(!allowed("https://github.com.evil.example/o/r"));
        assert!(!allowed("https://example.com/a.gz"));
    }
}
