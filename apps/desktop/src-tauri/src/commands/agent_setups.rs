//! Sharing the skills, MCP servers and plugins this computer's Claude Code and Codex use.

use devatlas_application::agent_setups::{
    self, LocalSetup, SetupItem, SetupPage, SetupPreview, SharedSetup,
};
use devatlas_application::community::{CommunityAuth, CommunityInputError};
use devatlas_storage::local_setup::LocalAgentSetup;
use tauri::{AppHandle, Manager, State};

use super::community::{Community, report};

/// What Claude Code and Codex have installed, read off the main thread.
async fn detect(app: &AppHandle) -> Result<Vec<SetupItem>, String> {
    let home = app.path().home_dir().map_err(report)?;
    tauri::async_runtime::spawn_blocking(move || LocalAgentSetup::new(&home).detect())
        .await
        .map_err(report)
}

async fn signed_in_id(community: &Community) -> Result<String, String> {
    Ok(community
        .server
        .auth()
        .current_user()
        .await
        .map_err(report)?
        .ok_or_else(|| CommunityInputError::NotSignedIn.to_string())?
        .id)
}

/// What sharing would offer: every installed item, as it would be published.
#[tauri::command]
pub async fn detect_agent_setup(app: AppHandle) -> Result<SetupPreview, String> {
    Ok(agent_setups::preview(detect(&app).await?))
}

/// Shared setups, newest first.
#[tauri::command]
pub async fn list_shared_setups(
    offset: u32,
    community: State<'_, Community>,
) -> Result<SetupPage, String> {
    agent_setups::browse(&community.server, offset)
        .await
        .map_err(report)
}

/// One account's shared setup, or `None` when it hasn't shared one.
#[tauri::command]
pub async fn get_shared_setup(
    owner_id: String,
    community: State<'_, Community>,
) -> Result<Option<SharedSetup>, String> {
    agent_setups::setup(&community.server, &owner_id)
        .await
        .map_err(report)
}

/// Shares the chosen items (by key), replacing the account's earlier setup. The backend
/// reads them from this computer itself, so only what is installed can be published.
#[tauri::command]
pub async fn share_agent_setup(
    keys: Vec<String>,
    description: Option<String>,
    app: AppHandle,
    community: State<'_, Community>,
) -> Result<(), String> {
    let detected = detect(&app).await?;
    agent_setups::share(&community.server, detected, &keys, description.as_deref())
        .await
        .map_err(report)
}

/// Takes the signed-in account's setup down.
#[tauri::command]
pub async fn unshare_agent_setup(community: State<'_, Community>) -> Result<(), String> {
    let owner_id = signed_in_id(&community).await?;
    agent_setups::unshare(&community.server, &owner_id)
        .await
        .map_err(report)
}

/// Reports a setup to the moderators. `false` when already reported.
#[tauri::command]
pub async fn report_shared_setup(
    owner_id: String,
    reason: Option<String>,
    community: State<'_, Community>,
) -> Result<bool, String> {
    agent_setups::report(&community.server, &owner_id, reason.as_deref())
        .await
        .map_err(report)
}
