//! Where DevAtlas Setup installed the app, from the Add/Remove Programs entry it writes. Lets a
//! development build point agents at the installed copy, which rebuilding never locks or
//! replaces.

use std::path::PathBuf;

/// The installer's entry under `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall`.
const UNINSTALL_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Uninstall\com.devatlas.app";
/// The app's file name in the install folder, as the installer writes it.
const APP_EXE: &str = "DevAtlas.exe";

/// The installed app, if DevAtlas Setup installed it and it is still there.
pub fn installed_app() -> Option<PathBuf> {
    installed_app_at(UNINSTALL_KEY)
}

#[cfg(windows)]
fn installed_app_at(key: &str) -> Option<PathBuf> {
    use winreg::RegKey;
    use winreg::enums::HKEY_CURRENT_USER;

    let entry = RegKey::predef(HKEY_CURRENT_USER).open_subkey(key).ok()?;
    let dir: String = entry.get_value("InstallLocation").ok()?;
    let app = PathBuf::from(dir).join(APP_EXE);
    app.is_file().then_some(app)
}

#[cfg(not(windows))]
fn installed_app_at(_key: &str) -> Option<PathBuf> {
    None
}

#[cfg(all(test, windows))]
mod tests {
    use winreg::RegKey;
    use winreg::enums::HKEY_CURRENT_USER;

    use super::*;

    #[test]
    fn finds_the_installed_app_only_while_it_exists() {
        let key = format!(r"Software\DevAtlasTests\install-{}", std::process::id());
        let dir = std::env::temp_dir().join(format!("devatlas-install-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let (entry, _) = RegKey::predef(HKEY_CURRENT_USER)
            .create_subkey(&key)
            .unwrap();
        entry
            .set_value("InstallLocation", &dir.display().to_string())
            .unwrap();

        assert_eq!(installed_app_at(&key), None, "no app file yet");
        std::fs::write(dir.join(APP_EXE), b"exe").unwrap();
        assert_eq!(installed_app_at(&key), Some(dir.join(APP_EXE)));
        assert_eq!(installed_app_at(r"Software\DevAtlasTests\missing"), None);

        RegKey::predef(HKEY_CURRENT_USER)
            .delete_subkey_all(r"Software\DevAtlasTests")
            .unwrap();
        std::fs::remove_dir_all(dir).unwrap();
    }
}
