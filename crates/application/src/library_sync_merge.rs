//! Three-way merge for library sync. Each computer keeps the copy it last agreed on with the
//! server (the base). Against it, a change on one side wins over no change on the other, so
//! deletions sync too; when both sides changed the same item, this computer's version wins.

use std::collections::{BTreeMap, BTreeSet};

use devatlas_domain::resource::Resource;

use crate::backup::{BACKUP_VERSION, Backup, BackupAnnotation, BackupGroup};
use crate::library::SavedLink;
use crate::snippets::Snippet;

/// Items to write and keys to delete in one list.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Changes<T> {
    pub put: Vec<T>,
    pub removed: Vec<String>,
}

impl<T> Default for Changes<T> {
    fn default() -> Self {
        Self {
            put: Vec::new(),
            removed: Vec::new(),
        }
    }
}

impl<T> Changes<T> {
    pub fn is_empty(&self) -> bool {
        self.put.is_empty() && self.removed.is_empty()
    }
}

/// What a sync changes on this computer.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SyncChanges {
    pub saved_links: Changes<SavedLink>,
    pub hidden: Changes<String>,
    pub annotations: Changes<BackupAnnotation>,
    pub groups: Changes<BackupGroup>,
    pub snippets: Changes<Snippet>,
}

impl SyncChanges {
    pub fn is_empty(&self) -> bool {
        self.saved_links.is_empty()
            && self.hidden.is_empty()
            && self.annotations.is_empty()
            && self.groups.is_empty()
            && self.snippets.is_empty()
    }

    /// Whether anything here would be deleted or overwritten, rather than only added.
    pub fn replaces_anything(&self, local: &Backup) -> bool {
        fn touches<T>(changes: &Changes<T>, local: &[T], key: impl Fn(&T) -> String) -> bool {
            let existing: BTreeSet<String> = local.iter().map(&key).collect();
            !changes.removed.is_empty()
                || changes.put.iter().any(|item| existing.contains(&key(item)))
        }
        touches(&self.saved_links, &local.saved_links, link_key)
            || !self.hidden.removed.is_empty()
            || touches(&self.annotations, &local.annotations, annotation_key)
            || touches(&self.groups, &local.groups, group_key)
            || touches(&self.snippets, &local.snippets, snippet_key)
    }
}

/// A saved link's resource id, which is how the library tells links apart.
pub fn link_key(link: &SavedLink) -> String {
    Resource::saved(&link.title, &link.url, link.added_at)
        .map_or_else(|| link.url.clone(), |resource| resource.id)
}

fn annotation_key(annotation: &BackupAnnotation) -> String {
    annotation.resource_id.clone()
}

fn group_key(group: &BackupGroup) -> String {
    group.id.clone()
}

fn snippet_key(snippet: &Snippet) -> String {
    snippet.id.clone()
}

/// An empty library, the base for a computer that has never synced.
pub fn empty_library() -> Backup {
    Backup {
        version: BACKUP_VERSION,
        exported_at: 0,
        saved_links: Vec::new(),
        hidden: Vec::new(),
        annotations: Vec::new(),
        groups: Vec::new(),
        snippets: Vec::new(),
    }
}

fn keyed<'a, T>(items: &'a [T], key: &impl Fn(&T) -> String) -> BTreeMap<String, &'a T> {
    items.iter().map(|item| (key(item), item)).collect()
}

fn sorted<T: Clone>(items: &[T], key: impl Fn(&T) -> String) -> Vec<T> {
    keyed(items, &key).into_values().cloned().collect()
}

/// The library with every list in key order and without duplicates, so equal libraries
/// compare equal however they were read.
pub fn canonical(library: Backup) -> Backup {
    Backup {
        saved_links: sorted(&library.saved_links, link_key),
        hidden: sorted(&library.hidden, String::clone),
        annotations: sorted(&library.annotations, annotation_key),
        groups: sorted(&library.groups, group_key),
        snippets: sorted(&library.snippets, snippet_key),
        ..library
    }
}

/// Merges one list. `resolve` decides an item both computers changed and both still have.
fn merge_list<T: Clone + PartialEq>(
    base: &[T],
    local: &[T],
    remote: &[T],
    key: impl Fn(&T) -> String,
    resolve: impl Fn(Option<&T>, &T, &T) -> T,
) -> Vec<T> {
    let (base, local, remote) = (keyed(base, &key), keyed(local, &key), keyed(remote, &key));
    let keys: BTreeSet<&String> = local.keys().chain(remote.keys()).collect();
    keys.into_iter()
        .filter_map(|id| {
            let (base, here, there) = (base.get(id), local.get(id), remote.get(id));
            if here == there || there == base {
                return here.map(|item| (*item).clone());
            }
            if here == base {
                return there.map(|item| (*item).clone());
            }
            match (here, there) {
                (Some(here), Some(there)) => Some(resolve(base.copied(), here, there)),
                // Edited on one side, deleted on the other: the edit wins.
                (here, there) => here.or(there).map(|item| (*item).clone()),
            }
        })
        .collect()
}

/// This computer's version of a changed item.
fn keep_local<T: Clone>(_: Option<&T>, here: &T, _: &T) -> T {
    here.clone()
}

/// One field both computers may have changed: a change here wins, else the other's.
fn field<T: Clone + PartialEq>(base: Option<&T>, here: &T, there: &T) -> T {
    if base == Some(here) { there } else { here }.clone()
}

/// A list of ids (members, tags) changed on both sides: each side's additions and removals
/// are kept, in this computer's order with the other's additions after.
fn merge_ids(base: Option<&[String]>, here: &[String], there: &[String]) -> Vec<String> {
    let base = base.unwrap_or_default();
    let removed_there = |id: &String| base.contains(id) && !there.contains(id);
    let added_there = |id: &&String| !base.contains(id) && !here.contains(id);
    here.iter()
        .filter(|id| !removed_there(id))
        .chain(there.iter().filter(added_there))
        .cloned()
        .collect()
}

fn merge_group(base: Option<&BackupGroup>, here: &BackupGroup, there: &BackupGroup) -> BackupGroup {
    BackupGroup {
        id: here.id.clone(),
        name: field(base.map(|b| &b.name), &here.name, &there.name),
        description: field(
            base.map(|b| &b.description),
            &here.description,
            &there.description,
        ),
        resource_ids: merge_ids(
            base.map(|b| b.resource_ids.as_slice()),
            &here.resource_ids,
            &there.resource_ids,
        ),
        created_at: here.created_at,
    }
}

fn merge_annotation(
    base: Option<&BackupAnnotation>,
    here: &BackupAnnotation,
    there: &BackupAnnotation,
) -> BackupAnnotation {
    BackupAnnotation {
        resource_id: here.resource_id.clone(),
        category: field(base.map(|b| &b.category), &here.category, &there.category),
        status: field(base.map(|b| &b.status), &here.status, &there.status),
        tags: merge_ids(base.map(|b| b.tags.as_slice()), &here.tags, &there.tags),
        note: field(base.map(|b| &b.note), &here.note, &there.note),
    }
}

/// Whether a library holds nothing at all, as when its files were lost.
pub fn is_empty(library: &Backup) -> bool {
    library.saved_links.is_empty()
        && library.hidden.is_empty()
        && library.annotations.is_empty()
        && library.groups.is_empty()
        && library.snippets.is_empty()
}

/// The library both computers should have now.
pub fn merge(base: &Backup, local: &Backup, remote: &Backup) -> Backup {
    Backup {
        version: BACKUP_VERSION,
        exported_at: local.exported_at,
        saved_links: merge_list(
            &base.saved_links,
            &local.saved_links,
            &remote.saved_links,
            link_key,
            keep_local,
        ),
        hidden: merge_list(
            &base.hidden,
            &local.hidden,
            &remote.hidden,
            String::clone,
            keep_local,
        ),
        annotations: merge_list(
            &base.annotations,
            &local.annotations,
            &remote.annotations,
            annotation_key,
            merge_annotation,
        ),
        groups: merge_list(
            &base.groups,
            &local.groups,
            &remote.groups,
            group_key,
            merge_group,
        ),
        snippets: merge_list(
            &base.snippets,
            &local.snippets,
            &remote.snippets,
            snippet_key,
            keep_local,
        ),
    }
}

fn diff<T: Clone + PartialEq>(local: &[T], merged: &[T], key: impl Fn(&T) -> String) -> Changes<T> {
    let (local, merged) = (keyed(local, &key), keyed(merged, &key));
    Changes {
        put: merged
            .iter()
            .filter(|(id, item)| local.get(*id) != Some(*item))
            .map(|(_, item)| (*item).clone())
            .collect(),
        removed: local
            .keys()
            .filter(|id| !merged.contains_key(*id))
            .cloned()
            .collect(),
    }
}

/// What has to change on this computer to turn `local` into `merged`.
pub fn changes(local: &Backup, merged: &Backup) -> SyncChanges {
    SyncChanges {
        saved_links: diff(&local.saved_links, &merged.saved_links, link_key),
        hidden: diff(&local.hidden, &merged.hidden, String::clone),
        annotations: diff(&local.annotations, &merged.annotations, annotation_key),
        groups: diff(&local.groups, &merged.groups, group_key),
        snippets: diff(&local.snippets, &merged.snippets, snippet_key),
    }
}

/// Whether two canonical libraries hold the same things, whenever they were made.
pub fn same_library(a: &Backup, b: &Backup) -> bool {
    a.saved_links == b.saved_links
        && a.hidden == b.hidden
        && a.annotations == b.annotations
        && a.groups == b.groups
        && a.snippets == b.snippets
}

#[cfg(test)]
mod tests {
    use super::*;

    fn link(url: &str, title: &str) -> SavedLink {
        SavedLink {
            url: url.to_owned(),
            title: title.to_owned(),
            added_at: 1,
        }
    }

    fn group(id: &str, name: &str, members: &[&str]) -> BackupGroup {
        BackupGroup {
            id: id.to_owned(),
            name: name.to_owned(),
            description: None,
            resource_ids: members.iter().map(|id| (*id).to_owned()).collect(),
            created_at: 1,
        }
    }

    fn library(links: Vec<SavedLink>, groups: Vec<BackupGroup>) -> Backup {
        canonical(Backup {
            saved_links: links,
            groups,
            ..empty_library()
        })
    }

    #[test]
    fn a_first_sync_keeps_everything_from_both_computers() {
        let here = library(vec![link("https://a.dev/", "A")], Vec::new());
        let there = library(
            vec![link("https://b.dev/", "B")],
            vec![group("g", "UI", &[])],
        );

        let merged = merge(&empty_library(), &here, &there);

        assert_eq!(merged.saved_links.len(), 2);
        assert_eq!(merged.groups.len(), 1);
        let applied = changes(&here, &merged);
        assert_eq!(applied.saved_links.put, [link("https://b.dev/", "B")]);
        assert!(applied.saved_links.removed.is_empty());
        assert!(!applied.replaces_anything(&here), "only additions");
    }

    #[test]
    fn a_deletion_on_one_computer_reaches_the_other() {
        let base = library(
            vec![link("https://a.dev/", "A"), link("https://b.dev/", "B")],
            vec![group("g", "UI", &["a.dev"])],
        );
        let here = base.clone();
        let there = library(vec![link("https://a.dev/", "A")], Vec::new());

        let merged = merge(&base, &here, &there);

        assert_eq!(merged.saved_links, [link("https://a.dev/", "A")]);
        assert!(merged.groups.is_empty());
        let applied = changes(&here, &merged);
        assert_eq!(applied.groups.removed, ["g"]);
        assert_eq!(applied.saved_links.removed.len(), 1);
        assert!(applied.replaces_anything(&here));
    }

    #[test]
    fn an_edit_wins_over_no_change_on_either_side() {
        let base = library(
            Vec::new(),
            vec![group("g", "UI", &[]), group("h", "Docs", &[])],
        );
        let here = library(
            Vec::new(),
            vec![group("g", "UI kits", &[]), group("h", "Docs", &[])],
        );
        let there = library(
            Vec::new(),
            vec![group("g", "UI", &[]), group("h", "Guides", &[])],
        );

        let merged = merge(&base, &here, &there);

        assert_eq!(merged.groups[0].name, "UI kits");
        assert_eq!(merged.groups[1].name, "Guides");
    }

    #[test]
    fn members_added_on_both_computers_are_all_kept() {
        let base = library(Vec::new(), vec![group("g", "UI", &["a", "b"])]);
        let here = library(Vec::new(), vec![group("g", "UI", &["a", "b", "x"])]);
        let there = library(Vec::new(), vec![group("g", "UI kits", &["b", "y"])]);

        let merged = merge(&base, &here, &there);

        assert_eq!(
            merged.groups[0].resource_ids,
            ["b", "x", "y"],
            "a removed there"
        );
        assert_eq!(merged.groups[0].name, "UI kits");
    }

    #[test]
    fn when_both_change_one_item_this_computer_wins_but_an_edit_beats_a_deletion() {
        let base = library(
            Vec::new(),
            vec![group("g", "UI", &[]), group("h", "Docs", &[])],
        );
        let here = library(Vec::new(), vec![group("g", "Mine", &[])]);
        let there = library(
            Vec::new(),
            vec![group("g", "Theirs", &[]), group("h", "Guides", &[])],
        );

        let merged = merge(&base, &here, &there);

        assert_eq!(merged.groups[0].name, "Mine");
        assert_eq!(
            merged.groups[1].name, "Guides",
            "renamed there, deleted here"
        );
    }

    #[test]
    fn nothing_changes_when_both_computers_agree() {
        let base = library(
            vec![link("https://a.dev/", "A")],
            vec![group("g", "UI", &["x"])],
        );

        let merged = merge(&base, &base, &base);

        assert!(same_library(&merged, &base));
        assert!(changes(&base, &merged).is_empty());
    }

    #[test]
    fn canonical_order_ignores_how_the_lists_were_read() {
        let one = library(
            vec![link("https://b.dev/", "B"), link("https://a.dev/", "A")],
            Vec::new(),
        );
        let other = library(
            vec![link("https://a.dev/", "A"), link("https://b.dev/", "B")],
            Vec::new(),
        );
        assert!(same_library(&one, &other));
    }
}
