use std::path::Path;

use devatlas_application::backup::Backup;
use devatlas_application::community::CommunityAuth;
use devatlas_application::library_sync::{
    self, LibrarySync, LocalLibrary, SyncError, SyncReport, SyncStatus, SyncStore,
};
use devatlas_application::library_sync_merge::SyncChanges;
use devatlas_storage::credentials::KeyringSecret;
use devatlas_storage::database::Database;
use devatlas_storage::library_sync_cipher::SyncCrypto;
use devatlas_storage::library_sync_state::JsonSyncState;
use tauri::State;
use tokio::sync::Mutex;

use super::community::{Community, report};
use super::library::{LibraryStore, now_ms};
use super::organizer::Organizer;
use super::settings::keyring_service;
use super::tools::library_backup;

/// The sync key's entry in the credential store, beside the GitHub token's.
const KEY_ACCOUNT: &str = "library-sync-key";
const SIGN_IN: &str = "Sign in with GitHub in Settings to sync your library.";

/// This computer's side of library sync: the key, what was last synced, and a lock so only
/// one sync runs at a time.
pub struct LibrarySyncSetup {
    pub(super) secrets: KeyringSecret,
    pub(super) state: JsonSyncState,
    pub(super) lock: Mutex<()>,
}

impl LibrarySyncSetup {
    pub fn new(data_dir: &Path) -> Self {
        Self {
            secrets: KeyringSecret::for_account(keyring_service(), KEY_ACCOUNT),
            state: JsonSyncState::new(
                data_dir.join("library-sync.json"),
                // A DevAtlas backup, so Settings > Import brings it back.
                data_dir.join("library-before-last-sync.json"),
            ),
            lock: Mutex::new(()),
        }
    }
}

/// This computer's library: the saved-links files under their lock, and the database.
struct ThisComputer<'a> {
    store: &'a LibraryStore,
    database: &'a Database,
}

impl LocalLibrary for ThisComputer<'_> {
    type Error = SyncError;

    async fn snapshot(&self) -> Result<Backup, SyncError> {
        library_backup(self.store, self.database)
            .await
            .map_err(|message| SyncError::Failed(message.into()))
    }

    async fn apply(&self, changes: &SyncChanges) -> Result<(), SyncError> {
        {
            let _guard = self.store.lock.lock().await;
            library_sync::apply_links(
                &self.store.saved,
                &self.store.memory,
                &changes.saved_links,
                &changes.hidden,
                now_ms(),
            )?;
        }
        self.database
            .apply_sync(changes)
            .await
            .map_err(|error| SyncError::Failed(Box::new(error)))
    }
}

async fn signed_in(community: &Community) -> Result<Option<String>, String> {
    Ok(community
        .server
        .auth()
        .current_user()
        .await
        .map_err(report)?
        .map(|user| user.id))
}

/// Runs `run` with the signed-in account and the ports a sync goes through.
macro_rules! with_sync {
    ($community:expr, $sync:expr, $store:expr, $organizer:expr, |$ports:ident, $owner:ident| $run:expr) => {{
        let _guard = $sync.lock.lock().await;
        let $owner = signed_in(&$community).await?.ok_or(SIGN_IN)?;
        let local = ThisComputer {
            store: &$store,
            database: $organizer.database()?,
        };
        let $ports = LibrarySync {
            server: &$community.server,
            cipher: &SyncCrypto,
            secrets: &$sync.secrets,
            state: &$sync.state,
            local: &local,
        };
        $run.await.map_err(report)
    }};
}

#[tauri::command]
pub async fn library_sync_status(
    community: State<'_, Community>,
    sync: State<'_, LibrarySyncSetup>,
) -> Result<SyncStatus, String> {
    let Some(owner) = signed_in(&community).await? else {
        return Ok(SyncStatus::SignedOut);
    };
    library_sync::status(&community.server, &sync.secrets, &sync.state, &owner)
        .await
        .map_err(report)
}

/// Turns sync on with the passphrase, the first time on any computer or again on this one.
/// The passphrase is only turned into a key here; it is never stored or sent.
#[tauri::command]
pub async fn turn_on_library_sync(
    passphrase: String,
    community: State<'_, Community>,
    sync: State<'_, LibrarySyncSetup>,
    store: State<'_, LibraryStore>,
    organizer: State<'_, Organizer>,
) -> Result<SyncReport, String> {
    with_sync!(community, sync, store, organizer, |ports, owner| ports
        .turn_on(&owner, &passphrase, now_ms()))
}

/// Deletes the synced copy and starts again from this library with a new passphrase.
#[tauri::command]
pub async fn start_library_sync_over(
    passphrase: String,
    community: State<'_, Community>,
    sync: State<'_, LibrarySyncSetup>,
    store: State<'_, LibraryStore>,
    organizer: State<'_, Organizer>,
) -> Result<SyncReport, String> {
    with_sync!(community, sync, store, organizer, |ports, owner| ports
        .start_over(&owner, &passphrase, now_ms()))
}

#[tauri::command]
pub async fn sync_library(
    community: State<'_, Community>,
    sync: State<'_, LibrarySyncSetup>,
    store: State<'_, LibraryStore>,
    organizer: State<'_, Organizer>,
) -> Result<SyncReport, String> {
    with_sync!(community, sync, store, organizer, |ports, owner| ports
        .sync(&owner, now_ms()))
}

/// Stops syncing on this computer. The library and the synced copy stay.
#[tauri::command]
pub async fn turn_off_library_sync(sync: State<'_, LibrarySyncSetup>) -> Result<(), String> {
    let _guard = sync.lock.lock().await;
    library_sync::turn_off(&sync.secrets, &sync.state).map_err(report)
}
