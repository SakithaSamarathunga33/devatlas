use std::sync::atomic::{AtomicBool, Ordering};

use devatlas_application::app_info::AppInfo;
use devatlas_application::discovery::RepoRelease;
use devatlas_application::updates;
use devatlas_storage::app_update::{InstalledApp, UpdateDownloads};
use tauri::{AppHandle, State};

use super::discovery::Discovery;

/// The public half of the key release.yml signs update packages with (`tauri signer
/// generate`). The private half is the `TAURI_SIGNING_PRIVATE_KEY` secret of the repository's
/// `release` environment.
const UPDATE_PUBLIC_KEY: &str = include_str!("../../update-signing.pub");

/// Set while an update installs, so a second press can't run a second swap alongside it.
static INSTALLING: AtomicBool = AtomicBool::new(false);

/// The CI run that built this binary (`DEVATLAS_BUILD`, set by ci.yml); `None` for local builds.
const BUILD: Option<&str> = option_env!("DEVATLAS_BUILD");

/// Returns the identity of the running application.
///
/// The version is taken from this crate's package, which inherits the workspace version and
/// is also the version Tauri bundles (`tauri.conf.json` deliberately omits `version`).
#[tauri::command]
pub fn get_app_info() -> AppInfo {
    tracing::debug!("get_app_info invoked");
    AppInfo::current(env!("CARGO_PKG_VERSION"))
}

/// `owner/name` of the GitHub repository whose releases are DevAtlas updates, from the
/// workspace's `repository` field.
fn releases_repo() -> &'static str {
    env!("CARGO_PKG_REPOSITORY").trim_start_matches("https://github.com/")
}

/// The newest DevAtlas release on GitHub, or `None` when this build is up to date.
#[tauri::command]
pub async fn check_for_update(
    discovery: State<'_, Discovery>,
) -> Result<Option<RepoRelease>, String> {
    newer_release(&discovery).await
}

/// Downloads the newer release's signed update package, swaps it in and restarts DevAtlas.
/// The release is looked up again here, so the webview never names what gets installed.
#[tauri::command]
pub async fn install_update(app: AppHandle, discovery: State<'_, Discovery>) -> Result<(), String> {
    if INSTALLING.swap(true, Ordering::SeqCst) {
        return Err("The update is already installing.".to_owned());
    }
    let installed = match download_and_install(&discovery).await {
        Ok(installed) => installed,
        Err(error) => {
            INSTALLING.store(false, Ordering::SeqCst);
            return Err(error);
        }
    };
    tracing::info!("updated; restarting");
    // The flag stays set: this copy is now `.old` and must not try to swap again.
    std::process::Command::new(installed.exe())
        .spawn()
        .map_err(|error| {
            format!("DevAtlas was updated but couldn't restart ({error}). Open it again.")
        })?;
    app.exit(0);
    Ok(())
}

async fn download_and_install(discovery: &Discovery) -> Result<InstalledApp, String> {
    let installed = InstalledApp::running().ok_or_else(|| {
        "Only a copy installed by DevAtlas Setup can update itself. Download Setup from the release page instead.".to_owned()
    })?;
    let release = newer_release(discovery)
        .await?
        .ok_or_else(|| "DevAtlas is already up to date.".to_owned())?;
    let downloads = UpdateDownloads::new().map_err(|error| error.to_string())?;
    updates::install_update(
        &downloads,
        &installed,
        UPDATE_PUBLIC_KEY,
        releases_repo(),
        &release.tag,
    )
    .await
    .map_err(|error| {
        tracing::warn!(%error, tag = %release.tag, "could not install the update");
        error.to_string()
    })?;
    Ok(installed)
}

/// Deletes the copy an earlier update set aside, when running the installed app.
pub fn remove_previous_version() {
    if let Some(installed) = InstalledApp::running() {
        installed.remove_previous();
    }
}

async fn newer_release(discovery: &Discovery) -> Result<Option<RepoRelease>, String> {
    let build = BUILD.and_then(|build| build.parse().ok());
    updates::newer_release(
        discovery.github(),
        releases_repo(),
        env!("CARGO_PKG_VERSION"),
        build,
    )
    .await
    .map_err(|error| {
        tracing::warn!(%error, "could not check for a DevAtlas update");
        error.to_string()
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    #[test]
    fn reports_desktop_package_identity() {
        let info = get_app_info();

        assert_eq!(info.name, "DevAtlas");
        assert_eq!(info.version, env!("CARGO_PKG_VERSION"));
        assert_eq!(info.platform, std::env::consts::OS);
    }

    #[test]
    fn the_built_in_update_key_is_a_minisign_public_key() {
        assert!(updates::is_public_key(UPDATE_PUBLIC_KEY));
    }

    #[test]
    fn updates_come_from_a_github_repository() {
        let repo = releases_repo();
        let (owner, name) = repo.split_once('/').unwrap_or_default();

        assert!(
            !owner.is_empty() && !name.is_empty() && !name.contains('/'),
            "{repo}"
        );
    }

    #[test]
    fn version_and_identity_stay_in_sync_across_manifests() {
        let package: Value = serde_json::from_str(include_str!("../../../package.json")).unwrap();
        let tauri_conf: Value =
            serde_json::from_str(include_str!("../../tauri.conf.json")).unwrap();

        assert_eq!(package["version"], env!("CARGO_PKG_VERSION"));
        assert_eq!(tauri_conf["productName"], get_app_info().name.as_str());
        assert_eq!(tauri_conf["identifier"], "com.devatlas.app");
        assert!(
            tauri_conf.get("version").is_none(),
            "tauri.conf.json must inherit the Cargo package version"
        );
    }
}
