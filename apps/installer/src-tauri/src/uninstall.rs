//! `"Uninstall DevAtlas.exe" --uninstall`: what Windows runs from Settings > Apps. No wizard UI,
//! just a confirmation and a result dialog.

use std::path::{Path, PathBuf};

use tauri::{AppHandle, Runtime};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

use crate::commands::shortcut_paths;
use crate::install::{self, UNINSTALL_KEY, UNINSTALLER_EXE};
use crate::system;

pub const FLAG: &str = "--uninstall";
const TITLE: &str = "Uninstall DevAtlas";

/// Asks, removes DevAtlas, reports the outcome and returns the process exit code.
/// Must run off the main thread: the dialogs block.
pub fn run<R: Runtime>(app: &AppHandle<R>) -> i32 {
    let exe = match uninstaller_location() {
        Ok(exe) => exe,
        Err(message) => {
            show(app, message, MessageDialogKind::Error);
            return 1;
        }
    };
    let dir = exe.parent().unwrap_or(Path::new(""));

    let confirmed = app
        .dialog()
        .message("Remove DevAtlas from this computer? Your saved library is kept.")
        .title(TITLE)
        .buttons(MessageDialogButtons::OkCancelCustom(
            "Uninstall".into(),
            "Cancel".into(),
        ))
        .blocking_show();
    if !confirmed {
        return 0;
    }

    let removed = shortcut_paths(app).and_then(|links| {
        install::uninstall(dir, &[links.desktop, links.start_menu], UNINSTALL_KEY)
            .map_err(|error| error.to_string())
    });
    if let Err(error) = removed {
        tracing::error!(%error, "uninstall failed");
        show(app, error, MessageDialogKind::Error);
        return 1;
    }
    show(app, "DevAtlas was removed.".into(), MessageDialogKind::Info);
    // Scheduled last: the cleanup can only delete this exe once the process has exited.
    if let Err(error) = system::schedule_removal(dir, &exe) {
        tracing::warn!(%error, dir = %dir.display(), "could not schedule folder removal");
    }
    0
}

/// The running exe, if it is the uninstaller inside an install folder. Anything else (say the
/// downloaded setup run with `--uninstall` from Downloads) must not delete files next to itself.
fn uninstaller_location() -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|error| error.to_string())?;
    let is_uninstaller = exe
        .file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.eq_ignore_ascii_case(UNINSTALLER_EXE));
    if is_uninstaller && exe.parent().is_some() {
        Ok(exe)
    } else {
        Err("Uninstall DevAtlas from Windows Settings > Apps.".into())
    }
}

fn show<R: Runtime>(app: &AppHandle<R>, message: String, kind: MessageDialogKind) {
    app.dialog()
        .message(message)
        .title(TITLE)
        .kind(kind)
        .blocking_show();
}
