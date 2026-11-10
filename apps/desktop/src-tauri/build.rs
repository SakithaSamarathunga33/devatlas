use tauri_build::{AppManifest, Attributes};

/// Every app command. Declaring them makes tauri-build generate `allow-*` permissions, so each
/// command must be granted explicitly in `capabilities/` (least privilege).
const COMMANDS: &[&str] = &[
    "get_app_info",
    "list_library",
    "mark_resource_opened",
    "add_link",
    "remove_link",
    "get_resource_preview",
    "list_trending_repos",
    "get_github_repo",
    "viewer_open",
    "viewer_set_bounds",
    "viewer_close",
    "viewer_go",
];

fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tauri_build::try_build(Attributes::new().app_manifest(AppManifest::new().commands(COMMANDS)))?;
    Ok(())
}
