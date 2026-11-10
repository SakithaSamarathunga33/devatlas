use devatlas_application::app_info::AppInfo;

/// Returns the identity of the running application.
///
/// The version is taken from this crate's package, which inherits the workspace version and
/// is also the version Tauri bundles (`tauri.conf.json` deliberately omits `version`).
#[tauri::command]
pub fn get_app_info() -> AppInfo {
    tracing::debug!("get_app_info invoked");
    AppInfo::current(env!("CARGO_PKG_VERSION"))
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
