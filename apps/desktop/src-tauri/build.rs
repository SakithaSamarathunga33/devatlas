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
    "get_repo_activity",
    "update_resource",
    "list_groups",
    "create_group",
    "update_group",
    "delete_group",
    "set_group_resources",
    "get_settings",
    "update_settings",
    "set_github_token",
    "clear_github_token",
    "list_snippets",
    "create_snippet",
    "update_snippet",
    "delete_snippet",
    "get_agent_connection",
    "import_github_stars",
    "list_removed_suggestions",
    "remove_suggestion",
    "restore_suggestions",
    "export_backup",
    "import_file",
    "check_links",
    "list_news",
    "list_top_stories",
    "list_language_rankings",
    "get_star_boards",
    "viewer_open",
    "viewer_set_bounds",
    "viewer_close",
    "viewer_go",
];

fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tauri_build::try_build(Attributes::new().app_manifest(AppManifest::new().commands(COMMANDS)))?;
    Ok(())
}
