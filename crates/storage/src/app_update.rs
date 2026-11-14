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
/// How many replaced copies may still be running at once (each under an agent server).
const MAX_ASIDE: usize = 8;
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
    /// Deletes every copy earlier updates set aside. One still running (right after an update,
    /// or under an AI agent's `--mcp` server) stays until a later start.
    pub fn remove_previous(&self) {
        for previous in aside_names(&self.exe) {
            if let Err(error) = fs::remove_file(&previous)
                && error.kind() != io::ErrorKind::NotFound
            {
                tracing::debug!(%error, path = %previous.display(), "a previous version is still in use");
            }
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
/// renamed but not overwritten, so the running copy moves aside to a free `.old` name first. Any failure
/// leaves the original in place.
fn replace_exe(exe: &Path, package: &[u8]) -> io::Result<()> {
    let new = aside(exe, "new");
    let set_aside = unpack(package, &new).and_then(|()| {
        let old = free_aside(exe)?;
        fs::rename(exe, &old).map(|()| old)
    });
    let old = match set_aside {
        Ok(old) => old,
        Err(error) => {
            let _ = fs::remove_file(&new);
            return Err(error);
        }
    };
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

/// Names a running copy can be set aside under: `DevAtlas.exe.old`, then `.old-2` … `.old-8`.
/// Setup uses the same names.
fn aside_names(exe: &Path) -> impl Iterator<Item = PathBuf> + '_ {
    (1..=MAX_ASIDE).map(move |n| match n {
        1 => aside(exe, "old"),
        n => aside(exe, &format!("old-{n}")),
    })
}

/// The first aside name that is free, deleting a leftover copy there if it no longer runs. A
/// name stays taken while an AI agent's `--mcp` server still runs the copy under it.
fn free_aside(exe: &Path) -> io::Result<PathBuf> {
    aside_names(exe)
        .find(|path| match fs::remove_file(path) {
            Ok(()) => true,
            Err(error) => error.kind() == io::ErrorKind::NotFound,
        })
        .ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::ResourceBusy,
                "older copies of DevAtlas are still running. Restart your AI coding agents, then try again.",
            )
        })
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

    /// Starts a real program from `path` (a copy of PING), as an agent's `DevAtlas.exe --mcp`
    /// keeps the app running with no window. Windows then refuses to delete or overwrite it.
    #[cfg(windows)]
    fn run_from(path: &Path) -> std::process::Child {
        let system32 = PathBuf::from(std::env::var_os("SystemRoot").unwrap()).join("System32");
        fs::copy(system32.join("PING.EXE"), path).unwrap();
        std::process::Command::new(path)
            .args(["-n", "30", "127.0.0.1"])
            .stdout(std::process::Stdio::null())
            .spawn()
            .unwrap()
    }

    /// An agent server started before the last update still runs the copy set aside as `.old`,
    /// and another runs the current copy: the update must still go through.
    #[cfg(windows)]
    #[test]
    fn updates_while_agent_servers_run_the_current_and_an_earlier_copy() {
        let (dir, exe) = installed("agents");
        let mut earlier = run_from(&dir.join("DevAtlas.exe.old"));
        let mut current = run_from(&exe);

        let result = replace_exe(&exe, &gzip(b"new app"));

        let app = InstalledApp { exe: exe.clone() };
        for child in [&mut earlier, &mut current] {
            let _ = child.kill();
            let _ = child.wait();
        }
        assert!(result.is_ok(), "{result:?}");
        assert_eq!(fs::read(&exe).unwrap(), b"new app");
        assert!(
            dir.join("DevAtlas.exe.old-2").exists(),
            "the busy copy moves to a free name"
        );
        app.remove_previous();
        assert!(!dir.join("DevAtlas.exe.old").exists());
        assert!(!dir.join("DevAtlas.exe.old-2").exists());
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
