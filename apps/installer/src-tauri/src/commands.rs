//! Commands the setup UI calls. Thin adapters over [`crate::install`].

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};

use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, Runtime, State};

use crate::install::{self, APP_EXE, Progress, Request, UNINSTALL_KEY};

/// The DevAtlas release exe, embedded at build time (see `build.rs`). Empty when the installer
/// was built without it; `install` then refuses to run.
static APP_PAYLOAD: &[u8] = include_bytes!(env!("DEVATLAS_PAYLOAD"));

/// Setup's state: whether an install is running, and the folder of the last successful one.
#[derive(Default)]
pub struct Installed {
    /// Set while `install` runs: blocks a second install and closing the window.
    pub busy: AtomicBool,
    /// `launch_app` only ever starts the app in this folder.
    dir: Mutex<Option<PathBuf>>,
}

/// Clears `Installed::busy` however `install` returns.
struct BusyGuard<'a>(&'a AtomicBool);

impl Drop for BusyGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

pub struct ShortcutPaths {
    pub desktop: PathBuf,
    pub start_menu: PathBuf,
}

pub fn shortcut_paths<R: Runtime>(app: &AppHandle<R>) -> Result<ShortcutPaths, String> {
    let paths = app.path();
    Ok(ShortcutPaths {
        desktop: paths.desktop_dir().map_err(message)?.join("DevAtlas.lnk"),
        start_menu: paths
            .data_dir()
            .map_err(message)?
            .join(r"Microsoft\Windows\Start Menu\Programs\DevAtlas.lnk"),
    })
}

fn message(error: impl std::fmt::Display) -> String {
    error.to_string()
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallDefaults {
    dir: String,
    required_bytes: u64,
    version: &'static str,
}

/// The suggested folder (per-user, so no admin prompt) and the space the install needs.
#[tauri::command]
pub fn get_install_defaults<R: Runtime>(app: AppHandle<R>) -> Result<InstallDefaults, String> {
    let dir = app
        .path()
        .local_data_dir()
        .map_err(message)?
        .join("Programs")
        .join("DevAtlas");
    let installer = std::env::current_exe().map_err(message)?;
    Ok(InstallDefaults {
        dir: dir.display().to_string(),
        required_bytes: install::required_bytes(APP_PAYLOAD.len(), &installer),
        version: env!("CARGO_PKG_VERSION"),
    })
}

/// Free bytes on the drive that would hold `dir`, or `null` when it cannot be measured.
/// Async and off the UI thread: a slow drive must not freeze the wizard.
#[tauri::command]
pub async fn get_available_space(dir: String) -> Option<u64> {
    tauri::async_runtime::spawn_blocking(move || install::available_space(Path::new(dir.trim())))
        .await
        .ok()
        .flatten()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallOptions {
    dir: String,
    desktop_shortcut: bool,
    start_menu_shortcut: bool,
}

#[tauri::command]
pub async fn install<R: Runtime>(
    app: AppHandle<R>,
    options: InstallOptions,
    on_progress: Channel<Progress>,
    installed: State<'_, Installed>,
) -> Result<(), String> {
    if installed.busy.swap(true, Ordering::SeqCst) {
        return Err("DevAtlas is already being installed.".into());
    }
    let _busy = BusyGuard(&installed.busy);
    let links = shortcut_paths(&app)?;
    let shortcuts: Vec<PathBuf> = [
        (options.desktop_shortcut, links.desktop),
        (options.start_menu_shortcut, links.start_menu),
    ]
    .into_iter()
    .filter_map(|(wanted, path)| wanted.then_some(path))
    .collect();
    let dir = PathBuf::from(options.dir.trim());
    let uninstaller = std::env::current_exe().map_err(message)?;

    let target = dir.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let request = Request {
            dir: &target,
            payload: APP_PAYLOAD,
            uninstaller: &uninstaller,
            shortcuts: &shortcuts,
            registry_key: UNINSTALL_KEY,
        };
        install::install(&request, &mut |progress| {
            // A closed window drops the channel; the install still finishes.
            let _ = on_progress.send(progress);
        })
    })
    .await
    .map_err(message)?
    .map_err(|error| {
        tracing::warn!(%error, "installation failed");
        error.to_string()
    })?;

    *installed.dir.lock().map_err(message)? = Some(dir);
    Ok(())
}

/// Starts the app that `install` just put in place.
#[tauri::command]
pub fn launch_app(installed: State<'_, Installed>) -> Result<(), String> {
    launch(&installed)
}

fn launch(installed: &Installed) -> Result<(), String> {
    let dir = installed
        .dir
        .lock()
        .map_err(message)?
        .clone()
        .ok_or("DevAtlas has not been installed yet.")?;
    Command::new(dir.join(APP_EXE))
        .current_dir(&dir)
        .spawn()
        .map(drop)
        .map_err(|error| format!("Could not start DevAtlas: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn launching_before_installing_explains_why_it_cannot() {
        let result = launch(&Installed::default());

        assert_eq!(
            result,
            Err("DevAtlas has not been installed yet.".to_string())
        );
    }

    #[test]
    fn progress_serializes_in_the_shape_the_ui_validates() {
        let progress = Progress {
            step: install::Step::Extracting,
            percent: 42,
        };

        let json = serde_json::to_string(&progress).unwrap();

        assert_eq!(json, r#"{"step":"extracting","percent":42}"#);
    }

    #[test]
    fn options_deserialize_from_the_ui_payload() {
        let options: InstallOptions = serde_json::from_str(
            r#"{"dir":"C:\\Apps\\DevAtlas","desktopShortcut":true,"startMenuShortcut":false}"#,
        )
        .unwrap();

        assert_eq!(options.dir, r"C:\Apps\DevAtlas");
        assert!(options.desktop_shortcut);
        assert!(!options.start_menu_shortcut);
    }
}
