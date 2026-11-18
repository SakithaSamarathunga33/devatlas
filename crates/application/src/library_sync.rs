//! Use case: library sync between the user's computers, through their Community account.
//! The library is sealed on the computer with a key made from the user's sync passphrase, so
//! the server only ever stores ciphertext; each computer needs the passphrase once.

use std::collections::BTreeSet;
use std::error::Error;
use std::future::Future;

use devatlas_domain::resource::Resource;
use serde::{Deserialize, Serialize};

use crate::backup::{self, Backup, BackupError};
use crate::library::{LibraryMemoryStore, ResourceMemory, SavedLink, SavedLinkStore};
use crate::library_sync_merge::{
    Changes, SyncChanges, canonical, changes, empty_library, is_empty, link_key, merge,
    same_library,
};
use crate::settings::SecretStore;

/// Shortest passphrase accepted. It is the only thing between the server and the library.
pub const MIN_PASSPHRASE_CHARS: usize = 10;
const MAX_PASSPHRASE_BYTES: usize = 1_024;
/// The server's limit on a sealed copy (`library_sync.data`).
pub const MAX_SEALED_BYTES: usize = 12 * 1024 * 1024;
/// Saves raced by another computer before giving up until the next sync.
const MAX_ATTEMPTS: usize = 3;

/// Which copy the server holds: `generation` changes when sync starts over with a new
/// passphrase, `revision` with every save.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RemoteHead {
    pub generation: String,
    pub revision: i64,
}

impl RemoteHead {
    fn next(&self) -> Self {
        Self {
            generation: self.generation.clone(),
            revision: self.revision.saturating_add(1),
        }
    }
}

/// The server's copy: sealed, so only its owner's computers can read it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RemoteCopy {
    pub head: RemoteHead,
    pub salt: String,
    pub sealed: String,
}

/// Port: the account's copy on the server. Only its owner can read or change it.
pub trait SyncServer {
    type Error: Error + Send + Sync + 'static;

    fn head(
        &self,
        owner: &str,
    ) -> impl Future<Output = Result<Option<RemoteHead>, Self::Error>> + Send;
    fn fetch(
        &self,
        owner: &str,
    ) -> impl Future<Output = Result<Option<RemoteCopy>, Self::Error>> + Send;
    /// Stores the first copy, of a generation chosen here at revision 1; `None` if another
    /// computer stored one first.
    fn create(
        &self,
        generation: &str,
        salt: &str,
        sealed: &str,
    ) -> impl Future<Output = Result<Option<RemoteHead>, Self::Error>> + Send;
    /// Replaces the copy if it is still `head`; `None` if it changed meanwhile.
    fn update(
        &self,
        head: &RemoteHead,
        sealed: &str,
    ) -> impl Future<Output = Result<Option<RemoteHead>, Self::Error>> + Send;
    fn delete(&self, owner: &str) -> impl Future<Output = Result<(), Self::Error>> + Send;
}

/// Port: turns the passphrase into a key and seals the library with it. Each seal is bound to
/// its account and to the generation and revision it is stored as, so an old copy can't be
/// put back in place of a newer one, or passed off as another account's.
pub trait SyncCipher {
    type Error: Error + Send + Sync + 'static;

    fn new_salt(&self) -> Result<String, Self::Error>;
    fn new_generation(&self) -> Result<String, Self::Error>;
    fn derive_key(
        &self,
        passphrase: &str,
        salt: &str,
    ) -> impl Future<Output = Result<String, Self::Error>> + Send;
    fn seal(
        &self,
        key: &str,
        library: &Backup,
        owner: &str,
        head: &RemoteHead,
    ) -> Result<String, Self::Error>;
    /// `None` when the key doesn't open it as that account's copy at `head`.
    fn open(
        &self,
        key: &str,
        sealed: &str,
        owner: &str,
        head: &RemoteHead,
    ) -> Result<Option<Backup>, Self::Error>;
}

/// What this computer remembers between syncs.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncState {
    pub owner: String,
    pub generation: String,
    pub revision: i64,
    /// Unix milliseconds.
    pub synced_at: i64,
    /// The library as last agreed with the server.
    pub base: Backup,
}

/// Port: [`SyncState`] on this computer, and a copy of the library from before the last sync
/// that deleted or overwrote something in it.
pub trait SyncStateStore {
    type Error: Error + Send + Sync + 'static;

    fn load(&self) -> Result<Option<SyncState>, Self::Error>;
    fn save(&self, state: &SyncState) -> Result<(), Self::Error>;
    fn clear(&self) -> Result<(), Self::Error>;
    fn keep_previous(&self, library: &Backup) -> Result<(), Self::Error>;
}

/// Port: this computer's library, read and changed as a whole.
pub trait LocalLibrary {
    type Error: Error + Send + Sync + 'static;

    fn snapshot(&self) -> impl Future<Output = Result<Backup, Self::Error>> + Send;
    fn apply(&self, changes: &SyncChanges) -> impl Future<Output = Result<(), Self::Error>> + Send;
}

/// Port: the parts of a sync stored in the database (notes, collections, snippets).
pub trait SyncStore {
    type Error: Error + Send + Sync + 'static;

    fn apply_sync(
        &self,
        changes: &SyncChanges,
    ) -> impl Future<Output = Result<(), Self::Error>> + Send;
}

/// The key, kept in the OS credential store, with what it is the key to.
#[derive(Serialize, Deserialize)]
struct SyncSecret {
    owner: String,
    generation: String,
    key: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(tag = "state", rename_all = "camelCase")]
pub enum SyncStatus {
    /// Not signed in to Community, which sync goes through. Decided by the caller.
    SignedOut,
    /// No copy on the server yet.
    Off,
    /// A copy exists, but this computer doesn't have its passphrase.
    NeedsPassphrase,
    #[serde(rename_all = "camelCase")]
    On { synced_at: Option<i64> },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncReport {
    /// Whether this computer's library changed.
    pub changed: bool,
    pub synced_at: i64,
}

#[derive(Debug, thiserror::Error)]
pub enum SyncError {
    #[error("Enter your sync passphrase on this computer to keep syncing.")]
    NeedsPassphrase,
    #[error("That passphrase doesn't open your synced library.")]
    WrongPassphrase,
    #[error(
        "Use a passphrase of at least {MIN_PASSPHRASE_CHARS} characters (and at most {MAX_PASSPHRASE_BYTES} bytes)."
    )]
    WeakPassphrase,
    #[error("Sync was turned off from another computer.")]
    Off,
    #[error("Your library kept changing on another computer. DevAtlas will try again shortly.")]
    Busy,
    #[error("Your library is too large to sync.")]
    TooLarge,
    #[error(
        "The synced copy can't be opened with this computer's key. If this keeps happening, turn sync off here and start it over."
    )]
    Unreadable,
    #[error(
        "The synced copy is older than the one this computer last synced, so it wasn't used. If this keeps happening, start sync over."
    )]
    WentBack,
    #[error("The synced library couldn't be used: {0}")]
    Invalid(#[from] BackupError),
    #[error(transparent)]
    Failed(Box<dyn Error + Send + Sync>),
}

fn failed<E: Error + Send + Sync + 'static>(error: E) -> SyncError {
    SyncError::Failed(Box::new(error))
}

fn check_passphrase(passphrase: &str) -> Result<(), SyncError> {
    if passphrase.chars().count() < MIN_PASSPHRASE_CHARS || passphrase.len() > MAX_PASSPHRASE_BYTES
    {
        return Err(SyncError::WeakPassphrase);
    }
    Ok(())
}

/// The stored key, if it belongs to `owner`. An unreadable entry counts as none.
fn load_secret<K: SecretStore>(secrets: &K, owner: &str) -> Result<Option<SyncSecret>, SyncError>
where
    K::Error: Send + Sync + 'static,
{
    Ok(secrets
        .load()
        .map_err(failed)?
        .and_then(|text| serde_json::from_str::<SyncSecret>(&text).ok())
        .filter(|secret| secret.owner == owner))
}

fn save_secret<K: SecretStore>(secrets: &K, secret: &SyncSecret) -> Result<(), SyncError>
where
    K::Error: Send + Sync + 'static,
{
    let text = serde_json::to_string(secret).map_err(failed)?;
    secrets.save(&text).map_err(failed)
}

/// A library from another computer, checked like an imported backup. Links get the same
/// cleaning as links added here (http(s) only, no credentials), and unusable ones are dropped.
fn checked(library: Backup) -> Result<Backup, SyncError> {
    let library = backup::clean(library)?;
    let saved_links = library
        .saved_links
        .iter()
        .filter_map(|link| {
            let resource = Resource::saved(&link.title, &link.url, link.added_at)?;
            Some(SavedLink {
                url: resource.url,
                title: resource.title,
                added_at: link.added_at,
            })
        })
        .collect();
    Ok(canonical(Backup {
        saved_links,
        ..library
    }))
}

/// Turns sync off on this computer: forgets the key and the base. The library stays.
pub fn turn_off<K, St>(secrets: &K, state: &St) -> Result<(), SyncError>
where
    K: SecretStore,
    K::Error: Send + Sync + 'static,
    St: SyncStateStore,
{
    secrets.delete().map_err(failed)?;
    state.clear().map_err(failed)
}

/// Whether sync is on here, waits for the passphrase, or isn't set up for the account.
pub async fn status<S, K, St>(
    server: &S,
    secrets: &K,
    state: &St,
    owner: &str,
) -> Result<SyncStatus, SyncError>
where
    S: SyncServer,
    K: SecretStore,
    K::Error: Send + Sync + 'static,
    St: SyncStateStore,
{
    if let Some(secret) = load_secret(secrets, owner)? {
        let synced_at = state
            .load()
            .map_err(failed)?
            .filter(|state| state.owner == owner && state.generation == secret.generation)
            .map(|state| state.synced_at);
        return Ok(SyncStatus::On { synced_at });
    }
    Ok(if server.head(owner).await.map_err(failed)?.is_some() {
        SyncStatus::NeedsPassphrase
    } else {
        SyncStatus::Off
    })
}

/// The ports a sync goes through.
pub struct LibrarySync<'a, S, C, K, St, L> {
    pub server: &'a S,
    pub cipher: &'a C,
    pub secrets: &'a K,
    pub state: &'a St,
    pub local: &'a L,
}

impl<S, C, K, St, L> LibrarySync<'_, S, C, K, St, L>
where
    S: SyncServer,
    C: SyncCipher,
    K: SecretStore,
    K::Error: Send + Sync + 'static,
    St: SyncStateStore,
    L: LocalLibrary,
{
    /// Turns sync on with the passphrase: stores this library as the first copy, or checks
    /// the passphrase against the existing copy and merges the two.
    pub async fn turn_on(
        &self,
        owner: &str,
        passphrase: &str,
        now_ms: i64,
    ) -> Result<SyncReport, SyncError> {
        check_passphrase(passphrase)?;
        let Some(copy) = self.server.fetch(owner).await.map_err(failed)? else {
            let first = self.prepare(owner, passphrase).await?;
            return self.start(owner, first, now_ms).await;
        };
        let key = self
            .cipher
            .derive_key(passphrase, &copy.salt)
            .await
            .map_err(failed)?;
        if self
            .cipher
            .open(&key, &copy.sealed, owner, &copy.head)
            .map_err(failed)?
            .is_none()
        {
            return Err(SyncError::WrongPassphrase);
        }
        save_secret(
            self.secrets,
            &SyncSecret {
                owner: owner.to_owned(),
                generation: copy.head.generation,
                key,
            },
        )?;
        // With no base for this copy (the state is per generation), the first sync here
        // keeps everything from both sides.
        self.sync(owner, now_ms).await
    }

    /// For a forgotten passphrase: deletes the server's copy and starts again from this
    /// library with a new passphrase. Other computers then ask for the new one.
    pub async fn start_over(
        &self,
        owner: &str,
        passphrase: &str,
        now_ms: i64,
    ) -> Result<SyncReport, SyncError> {
        check_passphrase(passphrase)?;
        // Ready to upload before anything is deleted.
        let first = self.prepare(owner, passphrase).await?;
        self.server.delete(owner).await.map_err(failed)?;
        turn_off(self.secrets, self.state)?;
        self.start(owner, first, now_ms).await
    }

    /// A first copy of this library under a new passphrase, sealed and ready to store.
    async fn prepare(&self, owner: &str, passphrase: &str) -> Result<FirstCopy, SyncError> {
        let salt = self.cipher.new_salt().map_err(failed)?;
        let head = RemoteHead {
            generation: self.cipher.new_generation().map_err(failed)?,
            revision: 1,
        };
        let key = self
            .cipher
            .derive_key(passphrase, &salt)
            .await
            .map_err(failed)?;
        let library = canonical(self.local.snapshot().await.map_err(failed)?);
        let sealed = self.seal(&key, &library, owner, &head)?;
        Ok(FirstCopy {
            head,
            salt,
            key,
            library,
            sealed,
        })
    }

    async fn start(
        &self,
        owner: &str,
        first: FirstCopy,
        now_ms: i64,
    ) -> Result<SyncReport, SyncError> {
        let head = self
            .server
            .create(&first.head.generation, &first.salt, &first.sealed)
            .await
            .map_err(failed)?
            // Another computer turned sync on at the same moment; its passphrase counts.
            .ok_or(SyncError::Busy)?;
        save_secret(
            self.secrets,
            &SyncSecret {
                owner: owner.to_owned(),
                generation: head.generation.clone(),
                key: first.key,
            },
        )?;
        self.state
            .save(&SyncState {
                owner: owner.to_owned(),
                generation: head.generation,
                revision: head.revision,
                synced_at: now_ms,
                base: first.library,
            })
            .map_err(failed)?;
        Ok(SyncReport {
            changed: false,
            synced_at: now_ms,
        })
    }

    /// Checked like a downloaded copy, so no computer uploads what the others would refuse.
    fn seal(
        &self,
        key: &str,
        library: &Backup,
        owner: &str,
        head: &RemoteHead,
    ) -> Result<String, SyncError> {
        backup::clean(library.clone())?;
        let sealed = self
            .cipher
            .seal(key, library, owner, head)
            .map_err(failed)?;
        if sealed.len() > MAX_SEALED_BYTES {
            return Err(SyncError::TooLarge);
        }
        Ok(sealed)
    }

    /// Brings this computer and the server's copy together: changes from either side are
    /// kept. The merged library is stored on the server first and only then applied here,
    /// after keeping a copy of this library when the sync deletes or overwrites anything.
    pub async fn sync(&self, owner: &str, now_ms: i64) -> Result<SyncReport, SyncError> {
        let secret = load_secret(self.secrets, owner)?.ok_or(SyncError::NeedsPassphrase)?;
        for _ in 0..MAX_ATTEMPTS {
            let Some(head) = self.server.head(owner).await.map_err(failed)? else {
                turn_off(self.secrets, self.state)?;
                return Err(SyncError::Off);
            };
            if head.generation != secret.generation {
                // Started over elsewhere, with a new passphrase.
                turn_off(self.secrets, self.state)?;
                return Err(SyncError::NeedsPassphrase);
            }
            let known = self
                .state
                .load()
                .map_err(failed)?
                .filter(|state| state.owner == owner && state.generation == head.generation);
            if known
                .as_ref()
                .is_some_and(|state| head.revision < state.revision)
            {
                return Err(SyncError::WentBack);
            }
            let remote = match &known {
                // Unchanged on the server since the last sync: no need to download it.
                Some(state) if state.revision == head.revision => {
                    (head.clone(), state.base.clone())
                }
                _ => match self.download(owner, &secret).await? {
                    Some(copy) => copy,
                    None => continue,
                },
            };
            let (remote_head, remote) = remote;
            let local = canonical(self.local.snapshot().await.map_err(failed)?);
            // Lost files here mustn't read as "everything was deleted": with no base, the
            // other computers' library comes back instead.
            let base = known
                .filter(|_| !is_empty(&local))
                .map_or_else(empty_library, |state| state.base);
            let merged = merge(&base, &local, &remote);
            let saved_head = if same_library(&merged, &remote) {
                remote_head
            } else {
                let next = remote_head.next();
                let sealed = self.seal(&secret.key, &merged, owner, &next)?;
                match self
                    .server
                    .update(&remote_head, &sealed)
                    .await
                    .map_err(failed)?
                {
                    Some(saved) => saved,
                    None => continue,
                }
            };
            let here = changes(&local, &merged);
            if here.replaces_anything(&local) {
                self.state.keep_previous(&local).map_err(failed)?;
            }
            if !here.is_empty() {
                self.local.apply(&here).await.map_err(failed)?;
            }
            self.state
                .save(&SyncState {
                    owner: owner.to_owned(),
                    generation: saved_head.generation,
                    revision: saved_head.revision,
                    synced_at: now_ms,
                    base: merged,
                })
                .map_err(failed)?;
            return Ok(SyncReport {
                changed: !here.is_empty(),
                synced_at: now_ms,
            });
        }
        Err(SyncError::Busy)
    }

    /// The server's copy, opened and checked; `None` if it started over meanwhile.
    async fn download(
        &self,
        owner: &str,
        secret: &SyncSecret,
    ) -> Result<Option<(RemoteHead, Backup)>, SyncError> {
        let copy = self
            .server
            .fetch(owner)
            .await
            .map_err(failed)?
            .ok_or(SyncError::Off)?;
        if copy.head.generation != secret.generation {
            return Ok(None);
        }
        let library = self
            .cipher
            .open(&secret.key, &copy.sealed, owner, &copy.head)
            .map_err(failed)?
            // Same generation, so the same passphrase: the copy was damaged or replaced.
            .ok_or(SyncError::Unreadable)?;
        Ok(Some((copy.head, checked(library)?)))
    }
}

/// A first copy, ready to store.
struct FirstCopy {
    head: RemoteHead,
    salt: String,
    key: String,
    library: Backup,
    sealed: String,
}

/// Applies a sync's saved-link and removed-link changes to the files that hold them. Links
/// arriving from another computer show up as new, like any link added elsewhere.
pub fn apply_links<Ls, M>(
    saved: &Ls,
    memory: &M,
    links: &Changes<SavedLink>,
    hidden: &Changes<String>,
    now_ms: i64,
) -> Result<(), SyncError>
where
    Ls: SavedLinkStore,
    Ls::Error: Send + Sync + 'static,
    M: LibraryMemoryStore,
    M::Error: Send + Sync + 'static,
{
    if !links.is_empty() {
        let removed: BTreeSet<&str> = links.removed.iter().map(String::as_str).collect();
        let mut arriving: Vec<(String, &SavedLink)> = links
            .put
            .iter()
            .map(|link| (link_key(link), link))
            .collect();
        let mut seen = BTreeSet::new();
        let mut next = Vec::new();
        for link in saved.load().map_err(failed)? {
            let id = link_key(&link);
            if removed.contains(id.as_str()) || !seen.insert(id.clone()) {
                continue;
            }
            match arriving.iter().position(|(key, _)| *key == id) {
                Some(index) => next.push(arriving.remove(index).1.clone()),
                None => next.push(link),
            }
        }
        next.extend(arriving.into_iter().map(|(_, link)| link.clone()));
        saved.save(&next).map_err(failed)?;
    }
    if links.removed.is_empty() && hidden.is_empty() {
        return Ok(());
    }
    let mut known = memory.load().map_err(failed)?.unwrap_or_default();
    // Forgotten like a link removed here, so adding it again marks it new.
    for id in &links.removed {
        known.remove(id);
    }
    for id in &hidden.removed {
        if known.get(id).is_some_and(|entry| entry.hidden) {
            known.remove(id);
        }
    }
    for id in &hidden.put {
        known
            .entry(id.clone())
            .or_insert(ResourceMemory {
                first_seen: now_ms,
                opened: true,
                hidden: false,
                opened_at: None,
            })
            .hidden = true;
    }
    memory.save(&known).map_err(failed)
}

#[cfg(test)]
#[path = "library_sync_tests.rs"]
mod tests;
