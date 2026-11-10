//! Windows integration: shortcuts, the Add/Remove Programs entry, and self-removal.
//! Other platforms get explicit "unsupported" errors; DevAtlas ships for Windows only.

#[cfg(not(windows))]
use std::{io, path::Path};

#[cfg(not(windows))]
use crate::install::InstallError;

#[cfg(windows)]
pub use windows::*;

#[cfg(windows)]
mod windows {
    use std::fs;
    use std::io;
    use std::os::windows::process::CommandExt;
    use std::path::Path;
    use std::process::Command;

    use winreg::RegKey;
    use winreg::enums::HKEY_CURRENT_USER;

    use crate::install::{APP_EXE, InstallError, UNINSTALLER_EXE};

    const UNINSTALL_ROOT: &str = r"Software\Microsoft\Windows\CurrentVersion\Uninstall";
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    fn uninstall_path(key: &str) -> String {
        format!(r"{UNINSTALL_ROOT}\{key}")
    }

    pub fn create_shortcut(target: &Path, link: &Path) -> Result<(), InstallError> {
        let failed = |message: String| InstallError::Shortcut {
            path: link.to_path_buf(),
            message,
        };
        if let Some(parent) = link.parent() {
            fs::create_dir_all(parent).map_err(|error| failed(error.to_string()))?;
        }
        let mut shortcut =
            mslnk::ShellLink::new(target).map_err(|error| failed(error.to_string()))?;
        shortcut.set_working_dir(target.parent().map(|dir| dir.display().to_string()));
        shortcut
            .create_lnk(link)
            .map_err(|error| failed(error.to_string()))
    }

    /// Adds the per-user Add/Remove Programs entry that points at the uninstaller.
    pub fn register(key: &str, dir: &Path, size_bytes: u64) -> io::Result<()> {
        let (entry, _) = RegKey::predef(HKEY_CURRENT_USER).create_subkey(uninstall_path(key))?;
        let uninstaller = dir.join(UNINSTALLER_EXE);
        entry.set_value("DisplayName", &"DevAtlas")?;
        entry.set_value("DisplayVersion", &env!("CARGO_PKG_VERSION"))?;
        entry.set_value("Publisher", &"DevAtlas contributors")?;
        entry.set_value("DisplayIcon", &dir.join(APP_EXE).display().to_string())?;
        entry.set_value("InstallLocation", &dir.display().to_string())?;
        entry.set_value(
            "UninstallString",
            &format!("\"{}\" --uninstall", uninstaller.display()),
        )?;
        entry.set_value("NoModify", &1u32)?;
        entry.set_value("NoRepair", &1u32)?;
        let size_kb = u32::try_from(size_bytes / 1024).unwrap_or(u32::MAX);
        entry.set_value("EstimatedSize", &size_kb)
    }

    pub fn unregister(key: &str) -> io::Result<()> {
        match RegKey::predef(HKEY_CURRENT_USER).delete_subkey_all(uninstall_path(key)) {
            Err(error) if error.kind() != io::ErrorKind::NotFound => Err(error),
            _ => Ok(()),
        }
    }

    #[cfg(test)]
    pub fn is_registered(key: &str) -> bool {
        RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey(uninstall_path(key))
            .is_ok()
    }

    /// A running exe cannot delete itself, so a hidden `cmd` waits for this process to exit,
    /// then deletes the uninstaller and the folder. `rmdir` without `/s` only removes an empty
    /// folder, so files the user added are kept.
    pub fn schedule_removal(dir: &Path, uninstaller: &Path) -> io::Result<()> {
        // Absolute System32 paths and a neutral working folder: a `cmd.exe` or `ping.exe`
        // planted next to the uninstaller never runs, and cmd does not lock the install folder.
        let system32 = std::env::var_os("SystemRoot")
            .map(|root| Path::new(&root).join("System32"))
            .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "SystemRoot is not set"))?;
        let ping = system32.join("PING.EXE").display().to_string();
        let (dir, uninstaller) = (dir.display().to_string(), uninstaller.display().to_string());
        // `%` would be expanded by cmd and `"` would end the quoted argument early.
        if [&dir, &uninstaller, &ping]
            .iter()
            .any(|p| p.contains(['%', '"']))
        {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "the install path contains characters cmd cannot quote",
            ));
        }
        // The ~2 s ping is the wait for this process to exit after its last dialog.
        Command::new(system32.join("cmd.exe"))
            .raw_arg(format!(
                "/C \"\"{ping}\" -n 3 127.0.0.1 >nul & del /f /q \"{uninstaller}\" & rmdir \"{dir}\"\""
            ))
            .current_dir(&system32)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map(drop)
    }
}

#[cfg(not(windows))]
fn unsupported() -> io::Error {
    io::Error::new(
        io::ErrorKind::Unsupported,
        "DevAtlas Setup only runs on Windows",
    )
}

#[cfg(not(windows))]
pub fn create_shortcut(_target: &Path, link: &Path) -> Result<(), InstallError> {
    Err(InstallError::Shortcut {
        path: link.to_path_buf(),
        message: unsupported().to_string(),
    })
}

#[cfg(not(windows))]
pub fn register(_key: &str, _dir: &Path, _size_bytes: u64) -> io::Result<()> {
    Err(unsupported())
}

#[cfg(not(windows))]
pub fn unregister(_key: &str) -> io::Result<()> {
    Err(unsupported())
}

#[cfg(not(windows))]
pub fn schedule_removal(_dir: &Path, _uninstaller: &Path) -> io::Result<()> {
    Err(unsupported())
}
