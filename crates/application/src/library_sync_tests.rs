use std::sync::Mutex;

use super::*;
use crate::backup::BackupGroup;
use crate::library::LibraryMemory;
use crate::library_sync_merge::empty_library;

const OWNER: &str = "0b8f4a9e-6d2c-4b1a-9f3e-2c7d5e8a1b40";
const PASSPHRASE: &str = "correct horse battery";

#[derive(Debug, thiserror::Error)]
#[error("unavailable")]
struct Unavailable;

#[derive(Default)]
struct Server {
    copy: Mutex<Option<RemoteCopy>>,
}

impl SyncServer for Server {
    type Error = Unavailable;

    async fn head(&self, _: &str) -> Result<Option<RemoteHead>, Unavailable> {
        Ok(self
            .copy
            .lock()
            .unwrap()
            .as_ref()
            .map(|copy| copy.head.clone()))
    }

    async fn fetch(&self, _: &str) -> Result<Option<RemoteCopy>, Unavailable> {
        Ok(self.copy.lock().unwrap().clone())
    }

    async fn create(
        &self,
        generation: &str,
        salt: &str,
        sealed: &str,
    ) -> Result<Option<RemoteHead>, Unavailable> {
        let mut copy = self.copy.lock().unwrap();
        if copy.is_some() {
            return Ok(None);
        }
        let head = RemoteHead {
            generation: generation.to_owned(),
            revision: 1,
        };
        *copy = Some(RemoteCopy {
            head: head.clone(),
            salt: salt.to_owned(),
            sealed: sealed.to_owned(),
        });
        Ok(Some(head))
    }

    async fn update(
        &self,
        head: &RemoteHead,
        sealed: &str,
    ) -> Result<Option<RemoteHead>, Unavailable> {
        let mut copy = self.copy.lock().unwrap();
        let Some(current) = copy.as_mut().filter(|copy| copy.head == *head) else {
            return Ok(None);
        };
        current.head.revision += 1;
        current.sealed = sealed.to_owned();
        Ok(Some(current.head.clone()))
    }

    async fn delete(&self, _: &str) -> Result<(), Unavailable> {
        *self.copy.lock().unwrap() = None;
        Ok(())
    }
}

/// Not encryption: a key is the passphrase and salt, and a seal names its key, owner and head.
/// Generations are unique across computers, as random ids are.
static GENERATIONS: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);

#[derive(Default)]
struct Cipher;

fn label(key: &str, owner: &str, head: &RemoteHead) -> String {
    format!("{key}|{owner}|{}@{}|", head.generation, head.revision)
}

impl SyncCipher for Cipher {
    type Error = Unavailable;

    fn new_salt(&self) -> Result<String, Unavailable> {
        Ok("salt".to_owned())
    }

    fn new_generation(&self) -> Result<String, Unavailable> {
        let next = GENERATIONS.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        Ok(format!("g{next}"))
    }

    async fn derive_key(&self, passphrase: &str, salt: &str) -> Result<String, Unavailable> {
        Ok(format!("{passphrase}+{salt}"))
    }

    fn seal(
        &self,
        key: &str,
        library: &Backup,
        owner: &str,
        head: &RemoteHead,
    ) -> Result<String, Unavailable> {
        Ok(format!(
            "{}{}",
            label(key, owner, head),
            serde_json::to_string(library).unwrap()
        ))
    }

    fn open(
        &self,
        key: &str,
        sealed: &str,
        owner: &str,
        head: &RemoteHead,
    ) -> Result<Option<Backup>, Unavailable> {
        Ok(sealed
            .strip_prefix(&label(key, owner, head))
            .map(|json| serde_json::from_str(json).unwrap()))
    }
}

#[derive(Default)]
struct Secrets(Mutex<Option<String>>);

impl SecretStore for Secrets {
    type Error = Unavailable;

    fn load(&self) -> Result<Option<String>, Unavailable> {
        Ok(self.0.lock().unwrap().clone())
    }
    fn save(&self, secret: &str) -> Result<(), Unavailable> {
        *self.0.lock().unwrap() = Some(secret.to_owned());
        Ok(())
    }
    fn delete(&self) -> Result<(), Unavailable> {
        *self.0.lock().unwrap() = None;
        Ok(())
    }
}

#[derive(Default)]
struct State {
    state: Mutex<Option<SyncState>>,
    previous: Mutex<Option<Backup>>,
}

impl SyncStateStore for State {
    type Error = Unavailable;

    fn load(&self) -> Result<Option<SyncState>, Unavailable> {
        Ok(self.state.lock().unwrap().clone())
    }
    fn save(&self, state: &SyncState) -> Result<(), Unavailable> {
        *self.state.lock().unwrap() = Some(state.clone());
        Ok(())
    }
    fn clear(&self) -> Result<(), Unavailable> {
        *self.state.lock().unwrap() = None;
        Ok(())
    }
    fn keep_previous(&self, library: &Backup) -> Result<(), Unavailable> {
        *self.previous.lock().unwrap() = Some(library.clone());
        Ok(())
    }
}

fn apply_list<T: Clone>(items: &mut Vec<T>, changes: &Changes<T>, key: impl Fn(&T) -> String) {
    items.retain(|item| {
        let id = key(item);
        !changes.removed.contains(&id) && !changes.put.iter().any(|put| key(put) == id)
    });
    items.extend(changes.put.iter().cloned());
}

/// One computer's library, held in memory.
struct Local(Mutex<Backup>);

impl LocalLibrary for Local {
    type Error = Unavailable;

    async fn snapshot(&self) -> Result<Backup, Unavailable> {
        Ok(self.0.lock().unwrap().clone())
    }

    async fn apply(&self, changes: &SyncChanges) -> Result<(), Unavailable> {
        let mut library = self.0.lock().unwrap();
        apply_list(&mut library.saved_links, &changes.saved_links, link_key);
        apply_list(&mut library.groups, &changes.groups, |group| {
            group.id.clone()
        });
        Ok(())
    }
}

struct Computer {
    cipher: Cipher,
    secrets: Secrets,
    state: State,
    local: Local,
}

impl Computer {
    fn with(links: &[&str]) -> Self {
        Self {
            cipher: Cipher,
            secrets: Secrets::default(),
            state: State::default(),
            local: Local(Mutex::new(Backup {
                saved_links: links.iter().map(|url| link(url)).collect(),
                ..empty_library()
            })),
        }
    }

    fn sync<'a>(
        &'a self,
        server: &'a Server,
    ) -> LibrarySync<'a, Server, Cipher, Secrets, State, Local> {
        LibrarySync {
            server,
            cipher: &self.cipher,
            secrets: &self.secrets,
            state: &self.state,
            local: &self.local,
        }
    }

    fn urls(&self) -> Vec<String> {
        let mut urls: Vec<String> = self
            .local
            .0
            .lock()
            .unwrap()
            .saved_links
            .iter()
            .map(|link| link.url.clone())
            .collect();
        urls.sort();
        urls
    }
}

fn link(url: &str) -> SavedLink {
    SavedLink {
        url: url.to_owned(),
        title: url.to_owned(),
        added_at: 1,
    }
}

fn block_on<F: Future>(future: F) -> F::Output {
    let waker = std::task::Waker::noop();
    let mut context = std::task::Context::from_waker(waker);
    let mut future = std::pin::pin!(future);
    loop {
        if let std::task::Poll::Ready(output) = future.as_mut().poll(&mut context) {
            return output;
        }
    }
}

#[test]
fn a_second_computer_gets_the_library_and_keeps_its_own() {
    let server = Server::default();
    let first = Computer::with(&["https://a.dev/"]);
    let second = Computer::with(&["https://b.dev/"]);

    block_on(first.sync(&server).turn_on(OWNER, PASSPHRASE, 1)).unwrap();
    let report = block_on(second.sync(&server).turn_on(OWNER, PASSPHRASE, 2)).unwrap();
    block_on(first.sync(&server).sync(OWNER, 3)).unwrap();

    assert!(report.changed);
    assert_eq!(second.urls(), ["https://a.dev/", "https://b.dev/"]);
    assert_eq!(first.urls(), ["https://a.dev/", "https://b.dev/"]);
}

#[test]
fn a_link_deleted_on_one_computer_is_deleted_on_the_other_and_kept_in_a_backup() {
    let server = Server::default();
    let first = Computer::with(&["https://a.dev/", "https://b.dev/"]);
    let second = Computer::with(&[]);
    block_on(first.sync(&server).turn_on(OWNER, PASSPHRASE, 1)).unwrap();
    block_on(second.sync(&server).turn_on(OWNER, PASSPHRASE, 2)).unwrap();

    first
        .local
        .0
        .lock()
        .unwrap()
        .saved_links
        .retain(|link| link.url != "https://b.dev/");
    block_on(first.sync(&server).sync(OWNER, 3)).unwrap();
    block_on(second.sync(&server).sync(OWNER, 4)).unwrap();

    assert_eq!(second.urls(), ["https://a.dev/"]);
    let previous = second.state.previous.lock().unwrap().clone().unwrap();
    assert_eq!(
        previous.saved_links.len(),
        2,
        "the library before the deletion"
    );
}

#[test]
fn the_server_only_ever_holds_sealed_copies() {
    let server = Server::default();
    let first = Computer::with(&["https://a.dev/"]);
    block_on(first.sync(&server).turn_on(OWNER, PASSPHRASE, 1)).unwrap();

    let copy = server.copy.lock().unwrap().clone().unwrap();
    assert!(
        copy.sealed
            .starts_with(&format!("{PASSPHRASE}+salt|{OWNER}|"))
    );
}

#[test]
fn a_wrong_passphrase_is_refused_and_nothing_is_stored() {
    let server = Server::default();
    let first = Computer::with(&["https://a.dev/"]);
    let second = Computer::with(&["https://b.dev/"]);
    block_on(first.sync(&server).turn_on(OWNER, PASSPHRASE, 1)).unwrap();

    let result = block_on(second.sync(&server).turn_on(OWNER, "not the passphrase", 2));

    assert!(matches!(result, Err(SyncError::WrongPassphrase)));
    assert!(second.secrets.0.lock().unwrap().is_none());
    assert_eq!(second.urls(), ["https://b.dev/"]);
}

#[test]
fn refuses_a_short_passphrase() {
    let server = Server::default();
    let first = Computer::with(&[]);
    assert!(matches!(
        block_on(first.sync(&server).turn_on(OWNER, "short", 1)),
        Err(SyncError::WeakPassphrase)
    ));
}

#[test]
fn starting_over_asks_other_computers_for_the_new_passphrase() {
    let server = Server::default();
    let first = Computer::with(&["https://a.dev/"]);
    let second = Computer::with(&[]);
    block_on(first.sync(&server).turn_on(OWNER, PASSPHRASE, 1)).unwrap();
    block_on(second.sync(&server).turn_on(OWNER, PASSPHRASE, 2)).unwrap();

    block_on(
        second
            .sync(&server)
            .start_over(OWNER, "a brand new passphrase", 3),
    )
    .unwrap();

    assert!(matches!(
        block_on(first.sync(&server).sync(OWNER, 4)),
        Err(SyncError::NeedsPassphrase)
    ));
    assert_eq!(
        block_on(status(&server, &first.secrets, &first.state, OWNER)).unwrap(),
        SyncStatus::NeedsPassphrase
    );
    assert_eq!(first.urls(), ["https://a.dev/"], "the library stays");
}

#[test]
fn another_accounts_key_is_not_used() {
    let server = Server::default();
    let first = Computer::with(&[]);
    block_on(first.sync(&server).turn_on(OWNER, PASSPHRASE, 1)).unwrap();

    assert!(matches!(
        block_on(first.sync(&server).sync("someone-else", 2)),
        Err(SyncError::NeedsPassphrase)
    ));
}

#[test]
fn reports_whether_sync_is_on() {
    let server = Server::default();
    let first = Computer::with(&[]);
    assert_eq!(
        block_on(status(&server, &first.secrets, &first.state, OWNER)).unwrap(),
        SyncStatus::Off
    );

    block_on(first.sync(&server).turn_on(OWNER, PASSPHRASE, 7)).unwrap();

    assert_eq!(
        block_on(status(&server, &first.secrets, &first.state, OWNER)).unwrap(),
        SyncStatus::On { synced_at: Some(7) }
    );
    turn_off(&first.secrets, &first.state).unwrap();
    assert_eq!(
        block_on(status(&server, &first.secrets, &first.state, OWNER)).unwrap(),
        SyncStatus::NeedsPassphrase
    );
}

#[test]
fn an_unchanged_library_is_not_uploaded_again() {
    let server = Server::default();
    let first = Computer::with(&["https://a.dev/"]);
    block_on(first.sync(&server).turn_on(OWNER, PASSPHRASE, 1)).unwrap();

    let report = block_on(first.sync(&server).sync(OWNER, 2)).unwrap();

    assert!(!report.changed);
    assert_eq!(
        server.copy.lock().unwrap().as_ref().unwrap().head.revision,
        1
    );
}

#[derive(Default)]
struct Files {
    saved: Mutex<Vec<SavedLink>>,
    memory: Mutex<LibraryMemory>,
}

impl SavedLinkStore for Files {
    type Error = Unavailable;
    fn load(&self) -> Result<Vec<SavedLink>, Unavailable> {
        Ok(self.saved.lock().unwrap().clone())
    }
    fn save(&self, links: &[SavedLink]) -> Result<(), Unavailable> {
        *self.saved.lock().unwrap() = links.to_vec();
        Ok(())
    }
}

impl LibraryMemoryStore for Files {
    type Error = Unavailable;
    fn load(&self) -> Result<Option<LibraryMemory>, Unavailable> {
        Ok(Some(self.memory.lock().unwrap().clone()))
    }
    fn save(&self, memory: &LibraryMemory) -> Result<(), Unavailable> {
        *self.memory.lock().unwrap() = memory.clone();
        Ok(())
    }
}

#[test]
fn applies_link_changes_in_place_and_hides_removed_bookmarks() {
    let files = Files::default();
    *files.saved.lock().unwrap() = vec![link("https://a.dev/"), link("https://b.dev/")];
    let renamed = SavedLink {
        title: "A, renamed".to_owned(),
        ..link("https://a.dev/")
    };
    let links = Changes {
        put: vec![renamed.clone(), link("https://c.dev/")],
        removed: vec![link_key(&link("https://b.dev/"))],
    };
    let hidden = Changes {
        put: vec!["bookmark.dev".to_owned()],
        removed: Vec::new(),
    };

    apply_links(&files, &files, &links, &hidden, 5).unwrap();

    assert_eq!(
        *files.saved.lock().unwrap(),
        [renamed, link("https://c.dev/")]
    );
    assert!(files.memory.lock().unwrap()["bookmark.dev"].hidden);
}

#[test]
fn a_group_deleted_here_but_renamed_there_comes_back() {
    let server = Server::default();
    let first = Computer::with(&[]);
    first.local.0.lock().unwrap().groups = vec![BackupGroup {
        id: "g".to_owned(),
        name: "UI".to_owned(),
        description: None,
        resource_ids: Vec::new(),
        created_at: 1,
    }];
    let second = Computer::with(&[]);
    block_on(first.sync(&server).turn_on(OWNER, PASSPHRASE, 1)).unwrap();
    block_on(second.sync(&server).turn_on(OWNER, PASSPHRASE, 2)).unwrap();

    second.local.0.lock().unwrap().groups[0].name = "UI kits".to_owned();
    first.local.0.lock().unwrap().groups.clear();
    block_on(second.sync(&server).sync(OWNER, 3)).unwrap();
    block_on(first.sync(&server).sync(OWNER, 4)).unwrap();

    assert_eq!(first.local.0.lock().unwrap().groups[0].name, "UI kits");
}

#[test]
fn a_copy_put_back_from_an_earlier_revision_is_refused() {
    let server = Server::default();
    let first = Computer::with(&["https://a.dev/"]);
    block_on(first.sync(&server).turn_on(OWNER, PASSPHRASE, 1)).unwrap();
    let old = server.copy.lock().unwrap().clone().unwrap();
    first
        .local
        .0
        .lock()
        .unwrap()
        .saved_links
        .push(link("https://b.dev/"));
    block_on(first.sync(&server).sync(OWNER, 2)).unwrap();

    // Someone with the account's session saves the first copy again, as a newer revision.
    {
        let mut copy = server.copy.lock().unwrap();
        let copy = copy.as_mut().unwrap();
        copy.sealed = old.sealed;
        copy.head.revision += 1;
    }
    let second = Computer::with(&[]);
    assert!(matches!(
        block_on(second.sync(&server).turn_on(OWNER, PASSPHRASE, 3)),
        Err(SyncError::WrongPassphrase)
    ));
    assert!(matches!(
        block_on(first.sync(&server).sync(OWNER, 4)),
        Err(SyncError::Unreadable)
    ));
    assert_eq!(first.urls(), ["https://a.dev/", "https://b.dev/"]);
}

#[test]
fn a_computer_whose_library_files_were_lost_gets_the_library_back() {
    let server = Server::default();
    let first = Computer::with(&["https://a.dev/", "https://b.dev/"]);
    block_on(first.sync(&server).turn_on(OWNER, PASSPHRASE, 1)).unwrap();

    first.local.0.lock().unwrap().saved_links.clear();
    block_on(first.sync(&server).sync(OWNER, 2)).unwrap();

    assert_eq!(first.urls(), ["https://a.dev/", "https://b.dev/"]);
}

#[test]
fn unsafe_links_from_another_computer_are_dropped() {
    let server = Server::default();
    let first = Computer::with(&["https://a.dev/"]);
    block_on(first.sync(&server).turn_on(OWNER, PASSPHRASE, 1)).unwrap();
    let planted = Backup {
        saved_links: vec![link("https://a.dev/"), link("javascript:alert(1)")],
        ..empty_library()
    };
    let generation = server
        .copy
        .lock()
        .unwrap()
        .as_ref()
        .unwrap()
        .head
        .generation
        .clone();
    let head = RemoteHead {
        generation,
        revision: 2,
    };
    let sealed = first
        .cipher
        .seal(&format!("{PASSPHRASE}+salt"), &planted, OWNER, &head)
        .unwrap();
    *server.copy.lock().unwrap() = Some(RemoteCopy {
        head,
        salt: "salt".to_owned(),
        sealed,
    });

    let second = Computer::with(&[]);
    block_on(second.sync(&server).turn_on(OWNER, PASSPHRASE, 2)).unwrap();

    assert_eq!(second.urls(), ["https://a.dev/"]);
}
