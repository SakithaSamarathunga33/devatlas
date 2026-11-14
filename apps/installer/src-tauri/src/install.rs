//! Installs and removes DevAtlas: writes the embedded app into a folder, adds shortcuts and an
//! Add/Remove Programs entry, and undoes exactly that on uninstall.

use std::fs::{self, File};
use std::io::{self, Write};
use std::path::{Component, Path, PathBuf, Prefix};

use serde::Serialize;

use crate::system;

/// File name of the installed app.
pub const APP_EXE: &str = "DevAtlas.exe";
/// File name of the installer copy that Windows runs to uninstall. Product-specific, so it never
/// overwrites another program's `uninstall.exe` in a folder the user typed.
pub const UNINSTALLER_EXE: &str = "Uninstall DevAtlas.exe";
/// Registry key under `HKCU\…\Uninstall`. The app identifier, so it never collides with the
/// key the Tauri NSIS bundle writes (`DevAtlas`).
pub const UNINSTALL_KEY: &str = "com.devatlas.app";

const CHUNK_BYTES: usize = 256 * 1024;
const EXTRACT_START: u8 = 5;
const EXTRACT_END: u8 = 85;

#[derive(Debug, thiserror::Error)]
pub enum InstallError {
    #[error("Choose a full folder path on a local drive, such as C:\\Apps\\DevAtlas.")]
    UnsupportedPath,
    #[error(
        "This installer does not contain the DevAtlas app. Rebuild it with `pnpm build:installer`."
    )]
    MissingPayload,
    #[error("Not enough free space: {} needed, {} available.", megabytes(*.required), megabytes(*.available))]
    NotEnoughSpace { required: u64, available: u64 },
    #[error("Could not {action} {}: {source}", path.display())]
    Io {
        action: &'static str,
        path: PathBuf,
        #[source]
        source: io::Error,
    },
    #[error(
        "DevAtlas is running. Close it, and restart any AI coding agents that use it, then try again."
    )]
    AppRunning,
    #[error("Could not create the shortcut {}: {message}", path.display())]
    Shortcut { path: PathBuf, message: String },
    #[error("Could not update the Windows app list: {0}")]
    Registry(#[source] io::Error),
}

fn io_error(action: &'static str, path: &Path) -> impl FnOnce(io::Error) -> InstallError {
    let path = path.to_path_buf();
    move |source| InstallError::Io {
        action,
        path,
        source,
    }
}

fn megabytes(bytes: u64) -> String {
    format!("{:.1} MB", bytes as f64 / 1_048_576.0)
}

/// The installation phases, in order. The UI shows one checklist row per step.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Step {
    Preparing,
    Extracting,
    Configuring,
    Finalizing,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct Progress {
    pub step: Step,
    pub percent: u8,
}

/// Everything one installation needs. Paths come from the Tauri path API in the caller.
pub struct Request<'a> {
    pub dir: &'a Path,
    /// The DevAtlas exe bytes embedded in this installer.
    pub payload: &'a [u8],
    /// The running installer, copied in as the uninstaller.
    pub uninstaller: &'a Path,
    /// `.lnk` files to create, each pointing at the installed app.
    pub shortcuts: &'a [PathBuf],
    pub registry_key: &'a str,
}

/// Bytes the installation occupies: the app plus the uninstaller copy.
pub fn required_bytes(payload_len: usize, uninstaller: &Path) -> u64 {
    let uninstaller_len = fs::metadata(uninstaller).map_or(0, |meta| meta.len());
    payload_len as u64 + uninstaller_len
}

/// A drive-letter path such as `C:\Apps`, with no `..`. Network shares (`\\host\share`) and device
/// paths (`\\?\`, `\\.\`) are refused: probing them blocks on the network.
pub fn is_local_absolute(dir: &Path) -> bool {
    let on_drive = matches!(
        dir.components().next(),
        Some(Component::Prefix(prefix)) if matches!(prefix.kind(), Prefix::Disk(_))
    );
    on_drive && dir.is_absolute() && !dir.components().any(|part| part == Component::ParentDir)
}

/// Free bytes on the volume that would hold `dir`, measured at its nearest existing ancestor.
pub fn available_space(dir: &Path) -> Option<u64> {
    if !is_local_absolute(dir) {
        return None;
    }
    dir.ancestors()
        .find(|ancestor| ancestor.is_dir())
        .and_then(|existing| fs4::available_space(existing).ok())
}

/// Runs a full installation, reporting progress after each unit of work.
pub fn install(
    request: &Request<'_>,
    report: &mut dyn FnMut(Progress),
) -> Result<(), InstallError> {
    let dir = request.dir;
    report(Progress {
        step: Step::Preparing,
        percent: 0,
    });
    if !is_local_absolute(dir) {
        return Err(InstallError::UnsupportedPath);
    }
    if request.payload.is_empty() {
        return Err(InstallError::MissingPayload);
    }
    // Checked before creating the folder, so a full drive leaves nothing behind.
    let required = required_bytes(request.payload.len(), request.uninstaller);
    if let Some(available) = available_space(dir).filter(|&available| available < required) {
        return Err(InstallError::NotEnoughSpace {
            required,
            available,
        });
    }
    fs::create_dir_all(dir).map_err(io_error("create the folder", dir))?;

    let app = dir.join(APP_EXE);
    extract(request.payload, &app, report)?;

    report(Progress {
        step: Step::Configuring,
        percent: 88,
    });
    copy_uninstaller(request.uninstaller, &dir.join(UNINSTALLER_EXE))?;
    // Registered before the shortcuts, so a later failure still leaves an uninstall entry.
    system::register(request.registry_key, dir, required).map_err(InstallError::Registry)?;
    for link in request.shortcuts {
        system::create_shortcut(&app, link)?;
    }

    report(Progress {
        step: Step::Finalizing,
        percent: 100,
    });
    tracing::info!(dir = %dir.display(), "DevAtlas installed");
    Ok(())
}

/// Writes the payload next to `target` and renames it into place, so a failed write never
/// leaves a truncated app behind.
fn extract(
    payload: &[u8],
    target: &Path,
    report: &mut dyn FnMut(Progress),
) -> Result<(), InstallError> {
    let partial = target.with_extension("exe.partial");
    if let Err(source) = write_chunked(&partial, payload, report) {
        // Best effort: the partial file is only debris at this point.
        let _ = fs::remove_file(&partial);
        return Err(io_error("write", target)(source));
    }
    let placed = fs::rename(&partial, target).or_else(|source| {
        // Windows won't replace a running exe (an AI agent's `--mcp` server keeps DevAtlas
        // running with no window) but will rename it: move it aside, then put the new one in.
        if source.kind() == io::ErrorKind::PermissionDenied {
            move_aside_and_place(&partial, target)
        } else {
            Err(source)
        }
    });
    placed.map_err(|source| {
        let _ = fs::remove_file(&partial);
        if source.kind() == io::ErrorKind::PermissionDenied {
            InstallError::AppRunning
        } else {
            io_error("replace", target)(source)
        }
    })
}

/// Renames the running `target` aside (DevAtlas deletes it on its next start) and moves
/// `partial` into its place, putting the original back if that last step fails.
fn move_aside_and_place(partial: &Path, target: &Path) -> io::Result<()> {
    let old = free_aside(target)?;
    fs::rename(target, &old)?;
    fs::rename(partial, target).inspect_err(|_| {
        let _ = fs::rename(&old, target);
    })
}

/// How many replaced copies may still be running at once (each under an agent server).
const MAX_ASIDE: u8 = 8;

/// The first free aside name, `DevAtlas.exe.old` then `.old-2` … `.old-8` (the names DevAtlas
/// cleans up), deleting a leftover copy there unless an agent server still runs it.
fn free_aside(target: &Path) -> io::Result<PathBuf> {
    (1..=MAX_ASIDE)
        .map(|n| match n {
            1 => target.with_extension("exe.old"),
            n => target.with_extension(format!("exe.old-{n}")),
        })
        .find(|path| match fs::remove_file(path) {
            Ok(()) => true,
            Err(error) => error.kind() == io::ErrorKind::NotFound,
        })
        .ok_or_else(|| io::Error::from(io::ErrorKind::PermissionDenied))
}

fn write_chunked(path: &Path, payload: &[u8], report: &mut dyn FnMut(Progress)) -> io::Result<()> {
    let mut file = File::create(path)?;
    let mut written = 0usize;
    for chunk in payload.chunks(CHUNK_BYTES) {
        file.write_all(chunk)?;
        written += chunk.len();
        report(Progress {
            step: Step::Extracting,
            percent: extract_percent(written, payload.len()),
        });
    }
    file.sync_all()
}

fn extract_percent(written: usize, total: usize) -> u8 {
    let span = u64::from(EXTRACT_END - EXTRACT_START);
    let done = span * written as u64 / total.max(1) as u64;
    EXTRACT_START + u8::try_from(done).unwrap_or(EXTRACT_END - EXTRACT_START)
}

fn copy_uninstaller(source: &Path, target: &Path) -> Result<(), InstallError> {
    // Re-running setup from the install folder: the uninstaller is already the running exe.
    if same_file(source, target) {
        return Ok(());
    }
    fs::copy(source, target)
        .map(drop)
        .map_err(io_error("copy the uninstaller to", target))
}

fn same_file(a: &Path, b: &Path) -> bool {
    matches!((fs::canonicalize(a), fs::canonicalize(b)), (Ok(a), Ok(b)) if a == b)
}

/// Removes what `install` added to `dir`, the shortcuts and the registry entry. The folder itself
/// and the running uninstaller are left for [`system::schedule_removal`]; files the user put in
/// the folder are never touched. User data (the library) lives elsewhere and is kept.
pub fn uninstall(
    dir: &Path,
    shortcuts: &[PathBuf],
    registry_key: &str,
) -> Result<(), InstallError> {
    remove_if_present(&dir.join(APP_EXE)).map_err(|error| match error {
        InstallError::Io { source, .. } if source.kind() == io::ErrorKind::PermissionDenied => {
            InstallError::AppRunning
        }
        other => other,
    })?;
    remove_if_present(&dir.join(APP_EXE).with_extension("exe.partial"))?;
    for link in shortcuts {
        remove_if_present(link)?;
    }
    system::unregister(registry_key).map_err(InstallError::Registry)?;
    tracing::info!(dir = %dir.display(), "DevAtlas uninstalled");
    Ok(())
}

fn remove_if_present(path: &Path) -> Result<(), InstallError> {
    match fs::remove_file(path) {
        Err(error) if error.kind() != io::ErrorKind::NotFound => {
            Err(io_error("remove", path)(error))
        }
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A fresh, empty folder under the system temp dir, removed on drop.
    struct TempDir(PathBuf);

    impl TempDir {
        fn new(name: &str) -> Self {
            let dir = std::env::temp_dir()
                .join(format!("devatlas-installer-{name}-{}", std::process::id()));
            let _ = fs::remove_dir_all(&dir);
            fs::create_dir_all(&dir).unwrap();
            Self(dir)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn fake_uninstaller(temp: &TempDir) -> PathBuf {
        let path = temp.0.join("setup.exe");
        fs::write(&path, b"setup").unwrap();
        path
    }

    #[test]
    fn rejects_a_relative_folder_before_touching_the_disk() {
        let temp = TempDir::new("relative");
        let uninstaller = fake_uninstaller(&temp);
        let request = Request {
            dir: Path::new("DevAtlas"),
            payload: b"app",
            uninstaller: &uninstaller,
            shortcuts: &[],
            registry_key: "unused",
        };

        let result = install(&request, &mut |_| {});

        assert!(matches!(result, Err(InstallError::UnsupportedPath)));
        assert!(!Path::new("DevAtlas").exists());
    }

    #[test]
    fn refuses_to_install_without_an_embedded_app() {
        let temp = TempDir::new("empty");
        let uninstaller = fake_uninstaller(&temp);
        let request = Request {
            dir: &temp.0.join("app"),
            payload: &[],
            uninstaller: &uninstaller,
            shortcuts: &[],
            registry_key: "unused",
        };

        let result = install(&request, &mut |_| {});

        assert!(matches!(result, Err(InstallError::MissingPayload)));
    }

    #[test]
    fn extracts_the_payload_atomically_and_reports_rising_progress() {
        let temp = TempDir::new("extract");
        let target = temp.0.join(APP_EXE);
        let payload = vec![7u8; CHUNK_BYTES * 3 + 10];
        let mut reports = Vec::new();

        extract(&payload, &target, &mut |progress| reports.push(progress)).unwrap();

        assert_eq!(fs::read(&target).unwrap(), payload);
        assert!(!target.with_extension("exe.partial").exists());
        let percents: Vec<u8> = reports.iter().map(|p| p.percent).collect();
        assert_eq!(percents.len(), 4);
        assert!(percents.windows(2).all(|w| w[0] < w[1]));
        assert_eq!(percents.last(), Some(&EXTRACT_END));
    }

    /// An AI agent's `DevAtlas.exe --mcp` server can keep the installed app running with no
    /// window open; installing must still succeed.
    #[cfg(windows)]
    #[test]
    fn replaces_an_app_that_is_still_running() {
        let temp = TempDir::new("running");
        let target = temp.0.join(APP_EXE);
        let system32 = PathBuf::from(std::env::var_os("SystemRoot").unwrap()).join("System32");
        fs::copy(system32.join("PING.EXE"), &target).unwrap();
        let mut running = std::process::Command::new(&target)
            .args(["-n", "30", "127.0.0.1"])
            .stdout(std::process::Stdio::null())
            .spawn()
            .unwrap();

        let result = extract(b"new app", &target, &mut |_| {});

        let _ = running.kill();
        let _ = running.wait();
        assert!(result.is_ok(), "{result:?}");
        assert_eq!(fs::read(&target).unwrap(), b"new app");
        assert!(
            target.with_extension("exe.old").exists(),
            "the running copy moves aside"
        );
        assert!(!target.with_extension("exe.partial").exists());
    }

    /// An agent server started before an earlier update still runs the copy set aside as
    /// `DevAtlas.exe.old`; that must not block installing again.
    #[cfg(windows)]
    #[test]
    fn replaces_the_app_while_an_earlier_copy_set_aside_still_runs() {
        let temp = TempDir::new("running-old");
        let target = temp.0.join(APP_EXE);
        let system32 = PathBuf::from(std::env::var_os("SystemRoot").unwrap()).join("System32");
        let run = |path: &Path| {
            fs::copy(system32.join("PING.EXE"), path).unwrap();
            std::process::Command::new(path)
                .args(["-n", "30", "127.0.0.1"])
                .stdout(std::process::Stdio::null())
                .spawn()
                .unwrap()
        };
        let mut earlier = run(&target.with_extension("exe.old"));
        let mut current = run(&target);

        let result = extract(b"new app", &target, &mut |_| {});

        for child in [&mut earlier, &mut current] {
            let _ = child.kill();
            let _ = child.wait();
        }
        assert!(result.is_ok(), "{result:?}");
        assert_eq!(fs::read(&target).unwrap(), b"new app");
        assert!(target.with_extension("exe.old-2").exists());
    }

    #[test]
    fn extract_percent_spans_the_extracting_band() {
        assert_eq!(extract_percent(0, 100), EXTRACT_START);
        assert_eq!(extract_percent(50, 100), 45);
        assert_eq!(extract_percent(100, 100), EXTRACT_END);
        assert_eq!(extract_percent(0, 0), EXTRACT_START);
    }

    #[test]
    fn required_bytes_counts_the_app_and_the_uninstaller() {
        let temp = TempDir::new("required");
        let uninstaller = fake_uninstaller(&temp);

        assert_eq!(required_bytes(100, &uninstaller), 105);
        assert_eq!(required_bytes(100, &temp.0.join("missing.exe")), 100);
    }

    #[test]
    fn available_space_measures_the_nearest_existing_folder() {
        let temp = TempDir::new("space");

        assert!(available_space(&temp.0.join("not/yet/created")).is_some_and(|free| free > 0));
    }

    #[test]
    fn copying_the_uninstaller_onto_itself_is_a_no_op() {
        let temp = TempDir::new("self-copy");
        let uninstaller = fake_uninstaller(&temp);

        copy_uninstaller(&uninstaller, &uninstaller).unwrap();

        assert_eq!(fs::read(&uninstaller).unwrap(), b"setup");
    }

    #[cfg(windows)]
    #[test]
    fn only_local_drive_paths_are_installable() {
        assert!(is_local_absolute(Path::new(r"C:\Apps\DevAtlas")));
        assert!(!is_local_absolute(Path::new(r"\\host\share\DevAtlas")));
        assert!(!is_local_absolute(Path::new(r"\\?\C:\DevAtlas")));
        assert!(!is_local_absolute(Path::new(r"C:\Apps\..\Windows")));
        assert!(!is_local_absolute(Path::new("C:DevAtlas")));
        assert_eq!(available_space(Path::new(r"\\host\share")), None);
    }

    #[test]
    fn megabytes_formats_one_decimal() {
        assert_eq!(megabytes(1_572_864), "1.5 MB");
    }

    #[cfg(windows)]
    #[test]
    fn installs_then_uninstalls_without_touching_user_files() {
        let temp = TempDir::new("roundtrip");
        let uninstaller = fake_uninstaller(&temp);
        let dir = temp.0.join("DevAtlas");
        let link = temp.0.join("DevAtlas.lnk");
        let key = format!("com.devatlas.installer-test-{}", std::process::id());
        let shortcuts = [link.clone()];
        let request = Request {
            dir: &dir,
            payload: b"app bytes",
            uninstaller: &uninstaller,
            shortcuts: &shortcuts,
            registry_key: &key,
        };
        let mut steps = Vec::new();

        install(&request, &mut |progress| steps.push(progress.step)).unwrap();
        fs::write(dir.join("notes.txt"), b"mine").unwrap();

        assert_eq!(fs::read(dir.join(APP_EXE)).unwrap(), b"app bytes");
        assert_eq!(fs::read(dir.join(UNINSTALLER_EXE)).unwrap(), b"setup");
        assert!(link.is_file());
        assert!(system::is_registered(&key));
        assert_eq!(steps.first(), Some(&Step::Preparing));
        assert_eq!(steps.last(), Some(&Step::Finalizing));

        uninstall(&dir, &shortcuts, &key).unwrap();

        assert!(!dir.join(APP_EXE).exists());
        assert!(!link.exists());
        assert!(!system::is_registered(&key));
        assert!(dir.join("notes.txt").is_file());
        // Uninstalling twice is harmless.
        uninstall(&dir, &shortcuts, &key).unwrap();
    }
}
