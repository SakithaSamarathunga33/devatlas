use std::fmt::{Debug, Display};
use std::path::Path;

use devatlas_application::community::{
    self, CommunityAuth, CommunityInputError, CommunityUser, FollowState, SharePreview,
    SharedCollection, SharedPage, SharedSummary,
};
use devatlas_application::organizer::{self, Group};
use devatlas_storage::community::{CommunityConfig, SupabaseCommunity, SupabaseError};
use devatlas_storage::community_auth::{BrowserOpener, SupabaseAuth};
use devatlas_storage::community_shares::JsonShares;
use devatlas_storage::credentials::KeyringSecret;
use tauri::{AppHandle, Runtime, State};
use tauri_plugin_opener::OpenerExt;
use tokio::sync::Mutex;

use super::library::{LibraryStore, read_library};
use super::organizer::Organizer;
use super::settings::keyring_service;

const COMMUNITY_URL: &str = "https://uiwlkpcwwrovbvwllcdd.supabase.co";
/// Supabase's publishable key: public by design. The server's row level security decides
/// what each request may do.
const COMMUNITY_KEY: &str = include_str!("../../community-key.txt");
/// The refresh token's entry in the credential store, beside the GitHub token's.
const SESSION_ACCOUNT: &str = "community-session";

/// The Community server, the signed-in account, and which local collections were shared.
pub struct Community {
    server: SupabaseCommunity,
    shares: JsonShares,
    /// Sharing read-modify-writes the shares file.
    lock: Mutex<()>,
}

impl Community {
    pub fn new<R: Runtime>(app: &AppHandle<R>, data_dir: &Path) -> Result<Self, SupabaseError> {
        let config = CommunityConfig::new(COMMUNITY_URL, COMMUNITY_KEY)?;
        let handle = app.clone();
        let open_browser: BrowserOpener = Box::new(move |url| {
            handle
                .opener()
                .open_url(url, None::<&str>)
                .map_err(|error| error.to_string())
        });
        let secret = KeyringSecret::for_account(keyring_service(), SESSION_ACCOUNT);
        let auth = SupabaseAuth::new(config.clone(), secret, open_browser)?;
        Ok(Self {
            server: SupabaseCommunity::new(config, auth)?,
            shares: JsonShares::new(data_dir.join("community-shares.json")),
            lock: Mutex::new(()),
        })
    }
}

/// Logs the full error; the UI only gets its plain message. Errors never hold tokens.
fn report<E: Debug + Display>(error: E) -> String {
    tracing::warn!(?error, "community command failed");
    error.to_string()
}

async fn find_group(organizer: &Organizer, group_id: &str) -> Result<Group, String> {
    organizer::list_groups(organizer.database()?)
        .await
        .map_err(report)?
        .into_iter()
        .find(|group| group.id == group_id)
        .ok_or_else(|| CommunityInputError::GroupNotFound.to_string())
}

/// The signed-in account, or `None`. Restores the stored session on first use.
#[tauri::command]
pub async fn community_session(
    community: State<'_, Community>,
) -> Result<Option<CommunityUser>, String> {
    community.server.auth().current_user().await.map_err(report)
}

/// Signs in with GitHub in the system browser; resolves once the browser comes back.
#[tauri::command]
pub async fn community_sign_in(
    app: AppHandle,
    community: State<'_, Community>,
) -> Result<CommunityUser, String> {
    let signed_in = community.server.auth().sign_in().await;
    // The browser had the focus for the GitHub page; bring DevAtlas back either way.
    crate::focus_main_window(&app);
    signed_in.map_err(report)
}

#[tauri::command]
pub fn community_cancel_sign_in(community: State<'_, Community>) {
    community.server.auth().cancel_sign_in();
}

#[tauri::command]
pub async fn community_sign_out(community: State<'_, Community>) -> Result<(), String> {
    community.server.auth().sign_out().await.map_err(report)
}

/// Deletes the Community account with everything it published, followed and reported, and
/// signs out. The local library is untouched.
#[tauri::command]
pub async fn delete_community_account(community: State<'_, Community>) -> Result<(), String> {
    let _guard = community.lock.lock().await;
    community::delete_account(community.server.auth(), &community.shares)
        .await
        .map_err(report)
}

/// Published collections, newest first, optionally matching `query`.
#[tauri::command]
pub async fn list_shared_collections(
    query: Option<String>,
    offset: u32,
    community: State<'_, Community>,
) -> Result<SharedPage, String> {
    community::browse(&community.server, query.as_deref(), offset)
        .await
        .map_err(report)
}

/// The signed-in account's published collections.
#[tauri::command]
pub async fn my_shared_collections(
    community: State<'_, Community>,
) -> Result<Vec<SharedSummary>, String> {
    let user = community
        .server
        .auth()
        .current_user()
        .await
        .map_err(report)?
        .ok_or_else(|| CommunityInputError::NotSignedIn.to_string())?;
    community::my_collections(&community.server, &user.id)
        .await
        .map_err(report)
}

#[tauri::command]
pub async fn get_shared_collection(
    id: String,
    community: State<'_, Community>,
) -> Result<SharedCollection, String> {
    community::collection(&community.server, &id)
        .await
        .map_err(report)
}

/// Exactly what sharing a local collection would make public.
#[tauri::command]
pub async fn preview_group_share(
    group_id: String,
    community: State<'_, Community>,
    organizer: State<'_, Organizer>,
    store: State<'_, LibraryStore>,
) -> Result<SharePreview, String> {
    let group = find_group(&organizer, &group_id).await?;
    let library = read_library(&store).await?;
    let shared_id = community::shared_id(&community.shares, &group.id).map_err(report)?;
    Ok(community::share_preview(
        &group,
        &library.resources,
        shared_id,
    ))
}

/// Publishes a local collection, or updates its published copy. Returns the published id.
#[tauri::command]
pub async fn share_group(
    group_id: String,
    community: State<'_, Community>,
    organizer: State<'_, Organizer>,
    store: State<'_, LibraryStore>,
) -> Result<String, String> {
    let group = find_group(&organizer, &group_id).await?;
    let library = read_library(&store).await?;
    let _guard = community.lock.lock().await;
    community::share_group(
        &community.server,
        &community.shares,
        &group,
        &library.resources,
    )
    .await
    .map_err(report)
}

/// Takes a published collection down. Only its owner can.
#[tauri::command]
pub async fn unshare_collection(id: String, community: State<'_, Community>) -> Result<(), String> {
    let _guard = community.lock.lock().await;
    community::unshare(&community.server, &community.shares, &id)
        .await
        .map_err(report)
}

/// Follows a collection; returns the new state with the server's follower count.
#[tauri::command]
pub async fn follow_shared_collection(
    id: String,
    community: State<'_, Community>,
) -> Result<FollowState, String> {
    community::set_following(&community.server, &id, true)
        .await
        .map_err(report)
}

/// Unfollows a collection; returns the new state with the server's follower count.
#[tauri::command]
pub async fn unfollow_shared_collection(
    id: String,
    community: State<'_, Community>,
) -> Result<FollowState, String> {
    community::set_following(&community.server, &id, false)
        .await
        .map_err(report)
}

/// Reports a collection to the moderators. `false` when already reported.
#[tauri::command]
pub async fn report_shared_collection(
    id: String,
    reason: Option<String>,
    community: State<'_, Community>,
) -> Result<bool, String> {
    community::report(&community.server, &id, reason.as_deref())
        .await
        .map_err(report)
}
