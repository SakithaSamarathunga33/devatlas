use devatlas_domain::PRODUCT_NAME;
use serde::Serialize;

/// Identity of the running DevAtlas build, as reported to the user interface.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub platform: String,
}

impl AppInfo {
    /// Describes the running application.
    ///
    /// `version` is supplied by the caller because only the delivery crate (the desktop
    /// binary) knows its own package version; this layer cannot know which binary links it.
    pub fn current(version: &str) -> Self {
        Self {
            name: PRODUCT_NAME.to_owned(),
            version: version.to_owned(),
            platform: std::env::consts::OS.to_owned(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn current_reports_product_name_given_version_and_host_platform() {
        let info = AppInfo::current("9.8.7");

        assert_eq!(info.name, "DevAtlas");
        assert_eq!(info.version, "9.8.7");
        assert_eq!(info.platform, std::env::consts::OS);
        assert!(!info.platform.is_empty());
    }

    /// The frontend's Zod schema (`app-info.types.ts`) relies on exactly these keys.
    #[test]
    fn serializes_to_the_ipc_contract_shape() {
        let json = serde_json::to_value(AppInfo::current("1.0.0")).unwrap();

        assert_eq!(
            json,
            serde_json::json!({
                "name": "DevAtlas",
                "version": "1.0.0",
                "platform": std::env::consts::OS,
            })
        );
    }
}
