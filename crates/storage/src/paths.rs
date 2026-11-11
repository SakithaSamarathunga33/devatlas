//! Per-user folders, resolved from the operating system's own locations. Used where no Tauri
//! window exists to ask, such as when DevAtlas runs as an AI agent's MCP server.

use std::path::PathBuf;

use devatlas_application::settings::Browser;

/// The app's data folder: the OS data folder plus the bundle identifier, as Tauri resolves it.
pub fn app_data_dir(identifier: &str) -> Option<PathBuf> {
    dirs::data_dir().map(|dir| dir.join(identifier))
}

/// A browser's data folder: for Chromium browsers the folder holding one folder per profile,
/// for Opera its one profile, and for Firefox the folder holding `profiles.ini`.
pub fn browser_user_data_dir(browser: Browser) -> Option<PathBuf> {
    #[cfg(windows)]
    let (root, parts): (Option<PathBuf>, &[&str]) = match browser {
        Browser::Brave => (
            dirs::data_local_dir(),
            &["BraveSoftware", "Brave-Browser", "User Data"],
        ),
        Browser::Chrome => (dirs::data_local_dir(), &["Google", "Chrome", "User Data"]),
        Browser::Edge => (dirs::data_local_dir(), &["Microsoft", "Edge", "User Data"]),
        Browser::Vivaldi => (dirs::data_local_dir(), &["Vivaldi", "User Data"]),
        Browser::Opera => (dirs::data_dir(), &["Opera Software", "Opera Stable"]),
        Browser::OperaGx => (dirs::data_dir(), &["Opera Software", "Opera GX Stable"]),
        Browser::Firefox => (dirs::data_dir(), &["Mozilla", "Firefox"]),
    };
    #[cfg(target_os = "macos")]
    let (root, parts): (Option<PathBuf>, &[&str]) = (
        dirs::data_dir(),
        match browser {
            Browser::Brave => &["BraveSoftware", "Brave-Browser"],
            Browser::Chrome => &["Google", "Chrome"],
            Browser::Edge => &["Microsoft Edge"],
            Browser::Vivaldi => &["Vivaldi"],
            Browser::Opera => &["com.operasoftware.Opera"],
            Browser::OperaGx => &["com.operasoftware.OperaGX"],
            Browser::Firefox => &["Firefox"],
        },
    );
    #[cfg(all(unix, not(target_os = "macos")))]
    let (root, parts): (Option<PathBuf>, &[&str]) = match browser {
        Browser::Brave => (dirs::config_dir(), &["BraveSoftware", "Brave-Browser"]),
        Browser::Chrome => (dirs::config_dir(), &["google-chrome"]),
        Browser::Edge => (dirs::config_dir(), &["microsoft-edge"]),
        Browser::Vivaldi => (dirs::config_dir(), &["vivaldi"]),
        Browser::Opera => (dirs::config_dir(), &["opera"]),
        // Opera GX has no Linux version.
        Browser::OperaGx => (None, &[]),
        Browser::Firefox => (dirs::home_dir(), &[".mozilla", "firefox"]),
    };
    Some(parts.iter().fold(root?, |path, part| path.join(part)))
}
