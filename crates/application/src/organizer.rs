//! Use cases for organizing the library: a link's category, tags and note, and collections.

use std::collections::{HashMap, HashSet};
use std::future::Future;

use devatlas_domain::resource::ResourceCategory;
use serde::{Deserialize, Serialize};

use crate::agent::is_hidden;
use crate::library::LibrarySnapshot;
use crate::link_health::LinkHealthMap;

const MAX_TAGS: usize = 20;
/// Tags accepted before trimming and de-duplicating, so cleaning stays cheap.
const MAX_RAW_TAGS: usize = 200;
const MAX_TAG_LEN: usize = 32;
const MAX_NOTE_LEN: usize = 2_000;
const MAX_NAME_LEN: usize = 80;
const MAX_DESCRIPTION_LEN: usize = 500;
const MAX_ID_LEN: usize = 2_048;
const MAX_GROUP_SIZE: usize = 10_000;

/// Where a link stands for the user.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ReadingStatus {
    ToRead,
    Trying,
    Using,
}

impl ReadingStatus {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::ToRead => "to-read",
            Self::Trying => "trying",
            Self::Using => "using",
        }
    }

    pub fn parse(text: &str) -> Option<Self> {
        [Self::ToRead, Self::Trying, Self::Using]
            .into_iter()
            .find(|status| status.as_str() == text)
    }
}

/// What the user added to a link. Stored by resource id, so it survives the link being
/// removed and restored. Also what the Edit dialog showed when it opened.
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceAnnotation {
    /// `None` keeps the automatic category.
    pub category: Option<ResourceCategory>,
    pub status: Option<ReadingStatus>,
    pub tags: Vec<String>,
    pub note: Option<String>,
}

pub type Annotations = HashMap<String, ResourceAnnotation>;

/// What `OrganizerStore::change_resource` found, and whether it saved.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Changed {
    pub before: Option<ResourceAnnotation>,
    pub written: bool,
}

/// An edit submitted from the UI.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceEdit {
    pub category: Option<ResourceCategory>,
    pub status: Option<ReadingStatus>,
    pub tags: Vec<String>,
    pub note: Option<String>,
    /// Every group the link belongs to after this edit.
    pub group_ids: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Group {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub resource_ids: Vec<String>,
    /// Unix milliseconds.
    pub created_at: i64,
}

/// Port: persists annotations and groups.
pub trait OrganizerStore {
    type Error: std::error::Error;

    fn annotations(&self) -> impl Future<Output = Result<Annotations, Self::Error>> + Send;
    /// In one transaction, so no other save lands in between: reads a link's annotation, and
    /// when `change` returns a new one, saves it and, given `group_ids`, the link's groups.
    fn change_resource<F>(
        &self,
        id: &str,
        group_ids: Option<&[String]>,
        change: F,
    ) -> impl Future<Output = Result<Changed, Self::Error>> + Send
    where
        F: FnOnce(Option<&ResourceAnnotation>) -> Option<ResourceAnnotation> + Send;
    fn groups(&self) -> impl Future<Output = Result<Vec<Group>, Self::Error>> + Send;
    fn create_group(
        &self,
        name: &str,
        description: Option<&str>,
        now_ms: i64,
    ) -> impl Future<Output = Result<Group, Self::Error>> + Send;
    /// Returns whether the group exists.
    fn update_group(
        &self,
        id: &str,
        name: &str,
        description: Option<&str>,
    ) -> impl Future<Output = Result<bool, Self::Error>> + Send;
    /// Returns whether the group existed. The links themselves are untouched.
    fn delete_group(&self, id: &str) -> impl Future<Output = Result<bool, Self::Error>> + Send;
    /// Replaces a group's links, all or nothing. Returns whether the group exists.
    fn set_group_resources(
        &self,
        id: &str,
        resource_ids: &[String],
    ) -> impl Future<Output = Result<bool, Self::Error>> + Send;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
pub enum InvalidInput {
    #[error("Use at most {MAX_TAGS} tags.")]
    TooManyTags,
    #[error("Tags can be at most {MAX_TAG_LEN} characters long.")]
    TagTooLong,
    #[error("Notes can be at most {MAX_NOTE_LEN} characters long.")]
    NoteTooLong,
    #[error("Enter a name.")]
    NameRequired,
    #[error("Names can be at most {MAX_NAME_LEN} characters long.")]
    NameTooLong,
    #[error("Descriptions can be at most {MAX_DESCRIPTION_LEN} characters long.")]
    DescriptionTooLong,
    #[error("That link isn't valid.")]
    InvalidId,
    #[error("Enter some code.")]
    CodeRequired,
    #[error("That snippet is too long.")]
    CodeTooLong,
    #[error("That language name is too long.")]
    LanguageTooLong,
}

/// Store failures are logged where they happen; the UI gets a plain message, never SQL.
#[derive(Debug, thiserror::Error)]
pub enum OrganizerError<E: std::error::Error> {
    #[error(transparent)]
    Invalid(#[from] InvalidInput),
    #[error("DevAtlas couldn't save that change. Please try again.")]
    Store(E),
    #[error(
        "This link changed while you were editing it, maybe by your AI agent. Close this and open it again to see the change."
    )]
    Changed,
}

/// Applies the user's annotations and the last link check to a loaded library.
pub fn annotate(
    snapshot: LibrarySnapshot,
    annotations: &Annotations,
    health: &LinkHealthMap,
) -> LibrarySnapshot {
    let resources = snapshot
        .resources
        .into_iter()
        .map(|mut item| {
            if let Some(annotation) = annotations.get(&item.resource.id) {
                if let Some(category) = annotation.category {
                    item.resource.category = category;
                }
                item.category_override = annotation.category;
                item.status = annotation.status;
                item.tags.clone_from(&annotation.tags);
                item.note.clone_from(&annotation.note);
            }
            item.link_health = health.get(&item.resource.id).copied();
            item
        })
        .collect();
    LibrarySnapshot {
        resources,
        ..snapshot
    }
}

/// Trims, lowercases and de-duplicates tags, within the limits.
pub(crate) fn clean_tags(raw: &[String]) -> Result<Vec<String>, InvalidInput> {
    if raw.len() > MAX_RAW_TAGS {
        return Err(InvalidInput::TooManyTags);
    }
    let mut seen = HashSet::new();
    let tags: Vec<String> = raw
        .iter()
        .map(|tag| tag.trim().to_lowercase())
        .filter(|tag| !tag.is_empty() && seen.insert(tag.clone()))
        .collect();
    if tags.len() > MAX_TAGS {
        return Err(InvalidInput::TooManyTags);
    }
    if tags.iter().any(|tag| tag.chars().count() > MAX_TAG_LEN) {
        return Err(InvalidInput::TagTooLong);
    }
    Ok(tags)
}

/// A note without hidden or control characters, which could carry text the developer can't
/// see to every agent that reads it. Line breaks and tabs stay.
pub fn visible_note(note: &str) -> String {
    note.chars()
        .filter(|&c| !is_hidden(c) && (c == '\n' || c == '\t' || !c.is_control()))
        .collect()
}

/// A note as stored: visible characters only, trimmed, `None` when blank, within the limit.
fn clean_note(note: &str) -> Result<Option<String>, InvalidInput> {
    let visible = visible_note(note);
    let note = visible.trim();
    if note.chars().count() > MAX_NOTE_LEN {
        return Err(InvalidInput::NoteTooLong);
    }
    Ok((!note.is_empty()).then(|| note.to_owned()))
}

pub(crate) fn clean_edit(edit: ResourceEdit) -> Result<ResourceEdit, InvalidInput> {
    if edit.group_ids.len() > MAX_GROUP_SIZE {
        return Err(InvalidInput::InvalidId);
    }
    let tags = clean_tags(&edit.tags)?;
    let note = edit.note.as_deref().map(clean_note).transpose()?.flatten();
    Ok(ResourceEdit { tags, note, ..edit })
}

pub(crate) fn clean_group(
    name: &str,
    description: Option<&str>,
) -> Result<(String, Option<String>), InvalidInput> {
    let name = name.trim();
    if name.is_empty() {
        return Err(InvalidInput::NameRequired);
    }
    if name.chars().count() > MAX_NAME_LEN {
        return Err(InvalidInput::NameTooLong);
    }
    let description = description.map(str::trim).filter(|text| !text.is_empty());
    if description.is_some_and(|text| text.chars().count() > MAX_DESCRIPTION_LEN) {
        return Err(InvalidInput::DescriptionTooLong);
    }
    Ok((name.to_owned(), description.map(str::to_owned)))
}

pub(crate) fn check_id(id: &str) -> Result<(), InvalidInput> {
    if id.is_empty() || id.len() > MAX_ID_LEN {
        return Err(InvalidInput::InvalidId);
    }
    Ok(())
}

/// Saves a link's category, tags, note and groups from the Edit dialog, unless the link changed
/// after the dialog showed `shown` (an agent may have written it since).
pub async fn update_resource<S: OrganizerStore>(
    store: &S,
    id: &str,
    edit: ResourceEdit,
    shown: &ResourceAnnotation,
) -> Result<(), OrganizerError<S::Error>> {
    check_id(id)?;
    let edit = clean_edit(edit)?;
    edit.group_ids.iter().try_for_each(|id| check_id(id))?;
    let annotation = ResourceAnnotation {
        category: edit.category,
        status: edit.status,
        tags: edit.tags,
        note: edit.note,
    };
    let unannotated = ResourceAnnotation::default();
    let changed = store
        .change_resource(id, Some(&edit.group_ids), |current| {
            (current.unwrap_or(&unannotated) == shown).then_some(annotation)
        })
        .await
        .map_err(OrganizerError::Store)?;
    if changed.written {
        Ok(())
    } else {
        Err(OrganizerError::Changed)
    }
}

/// A partial edit, from an AI agent: a field left `None` stays as it is.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ResourcePatch {
    /// `Some(None)` returns to the automatic category.
    pub category: Option<Option<ResourceCategory>>,
    /// `Some(None)` clears the status.
    pub status: Option<Option<ReadingStatus>>,
    /// Replaces every tag; an empty list removes them.
    pub tags: Option<Vec<String>>,
    /// A blank note removes it.
    pub note: Option<String>,
}

/// Changes only the fields a patch names, keeping the rest and the link's collections, in one
/// transaction so a save from the app can't be lost. Returns the annotation it replaced.
pub async fn patch_resource<S: OrganizerStore>(
    store: &S,
    id: &str,
    patch: ResourcePatch,
) -> Result<Option<ResourceAnnotation>, OrganizerError<S::Error>> {
    check_id(id)?;
    // Checked before the transaction, so merging inside it can't fail.
    let tags = patch.tags.as_deref().map(clean_tags).transpose()?;
    let note = patch.note.as_deref().map(clean_note).transpose()?;
    let changed = store
        .change_resource(id, None, |current| {
            let current = current.cloned().unwrap_or_default();
            Some(ResourceAnnotation {
                category: patch.category.unwrap_or(current.category),
                status: patch.status.unwrap_or(current.status),
                tags: tags.unwrap_or(current.tags),
                note: note.unwrap_or(current.note),
            })
        })
        .await
        .map_err(OrganizerError::Store)?;
    Ok(changed.before)
}

pub async fn list_groups<S: OrganizerStore>(
    store: &S,
) -> Result<Vec<Group>, OrganizerError<S::Error>> {
    store.groups().await.map_err(OrganizerError::Store)
}

pub async fn create_group<S: OrganizerStore>(
    store: &S,
    name: &str,
    description: Option<&str>,
    now_ms: i64,
) -> Result<Group, OrganizerError<S::Error>> {
    let (name, description) = clean_group(name, description)?;
    store
        .create_group(&name, description.as_deref(), now_ms)
        .await
        .map_err(OrganizerError::Store)
}

pub async fn update_group<S: OrganizerStore>(
    store: &S,
    id: &str,
    name: &str,
    description: Option<&str>,
) -> Result<bool, OrganizerError<S::Error>> {
    check_id(id)?;
    let (name, description) = clean_group(name, description)?;
    store
        .update_group(id, &name, description.as_deref())
        .await
        .map_err(OrganizerError::Store)
}

pub async fn delete_group<S: OrganizerStore>(
    store: &S,
    id: &str,
) -> Result<bool, OrganizerError<S::Error>> {
    check_id(id)?;
    store.delete_group(id).await.map_err(OrganizerError::Store)
}

pub async fn set_group_resources<S: OrganizerStore>(
    store: &S,
    id: &str,
    resource_ids: &[String],
) -> Result<bool, OrganizerError<S::Error>> {
    check_id(id)?;
    if resource_ids.len() > MAX_GROUP_SIZE {
        return Err(InvalidInput::InvalidId.into());
    }
    resource_ids.iter().try_for_each(|id| check_id(id))?;
    store
        .set_group_resources(id, resource_ids)
        .await
        .map_err(OrganizerError::Store)
}

#[cfg(test)]
mod tests {
    use devatlas_domain::resource::{Resource, ResourceCategory};

    use super::*;
    use crate::library::{LibraryItem, LibrarySource};
    use crate::link_health::{LinkHealth, LinkHealthMap};

    fn edit(tags: &[&str], note: Option<&str>) -> ResourceEdit {
        ResourceEdit {
            category: None,
            status: None,
            tags: tags.iter().map(|tag| (*tag).to_owned()).collect(),
            note: note.map(str::to_owned),
            group_ids: Vec::new(),
        }
    }

    #[test]
    fn cleans_tags_by_trimming_lowercasing_and_dropping_repeats() {
        let cleaned = clean_edit(edit(&[" React ", "react", "", "  CSS"], None)).unwrap();

        assert_eq!(cleaned.tags, ["react", "css"]);
    }

    #[test]
    fn notes_lose_hidden_and_control_characters_but_keep_line_breaks() {
        let cleaned = clean_edit(edit(
            &[],
            Some("Use\u{202E} it\u{200B}\u{E0041}\r\n\tfor charts\u{7}"),
        ))
        .unwrap();

        assert_eq!(cleaned.note.as_deref(), Some("Use it\n\tfor charts"));
    }

    #[test]
    fn a_blank_note_means_no_note() {
        assert_eq!(clean_edit(edit(&[], Some("   "))).unwrap().note, None);
        assert_eq!(
            clean_edit(edit(&[], Some(" keep me ")))
                .unwrap()
                .note
                .as_deref(),
            Some("keep me")
        );
    }

    #[test]
    fn refuses_oversized_input() {
        let many: Vec<String> = (0..=MAX_TAGS).map(|n| n.to_string()).collect();
        let many: Vec<&str> = many.iter().map(String::as_str).collect();
        let long_tag = "x".repeat(MAX_TAG_LEN + 1);
        let long_note = "x".repeat(MAX_NOTE_LEN + 1);

        assert_eq!(
            clean_edit(edit(&many, None)),
            Err(InvalidInput::TooManyTags)
        );
        assert_eq!(
            clean_edit(edit(&[long_tag.as_str()], None)),
            Err(InvalidInput::TagTooLong)
        );
        assert_eq!(
            clean_edit(edit(&[], Some(&long_note))),
            Err(InvalidInput::NoteTooLong)
        );
    }

    #[test]
    fn refuses_oversized_lists_before_processing_them() {
        let huge = vec!["x".to_owned(); MAX_RAW_TAGS + 1];
        let tags = ResourceEdit {
            tags: huge,
            ..edit(&[], None)
        };
        assert_eq!(clean_edit(tags), Err(InvalidInput::TooManyTags));

        let groups = ResourceEdit {
            group_ids: vec!["g".to_owned(); MAX_GROUP_SIZE + 1],
            ..edit(&[], None)
        };
        assert_eq!(clean_edit(groups), Err(InvalidInput::InvalidId));
    }

    #[test]
    fn group_names_are_trimmed_and_required() {
        assert_eq!(
            clean_group(" Client work ", Some("  ")).unwrap(),
            ("Client work".to_owned(), None)
        );
        assert_eq!(clean_group("   ", None), Err(InvalidInput::NameRequired));
        assert_eq!(
            clean_group(&"x".repeat(MAX_NAME_LEN + 1), None),
            Err(InvalidInput::NameTooLong)
        );
        assert_eq!(
            clean_group("ok", Some(&"x".repeat(MAX_DESCRIPTION_LEN + 1))),
            Err(InvalidInput::DescriptionTooLong)
        );
    }

    fn snapshot() -> LibrarySnapshot {
        let item = |title: &str, url: &str| LibraryItem {
            resource: Resource::from_bookmark(title, url, &[], None).unwrap(),
            is_new: false,
            category_override: None,
            status: None,
            tags: Vec::new(),
            note: None,
            last_opened_at: None,
            link_health: None,
        };
        LibrarySnapshot {
            source: LibrarySource {
                browser: "Brave".to_owned(),
                folder: "develop".to_owned(),
                warning: None,
            },
            resources: vec![
                item("Motion", "https://motion.dev/"),
                item("Other", "https://other.example/"),
            ],
        }
    }

    #[test]
    fn annotations_override_the_category_and_add_tags_and_notes() {
        let annotations = Annotations::from([(
            "other.example".to_owned(),
            ResourceAnnotation {
                category: Some(ResourceCategory::Icons),
                status: None,
                tags: vec!["svg".to_owned()],
                note: Some("nice".to_owned()),
            },
        )]);

        let annotated = annotate(snapshot(), &annotations, &LinkHealthMap::new());

        let [motion, other] = annotated.resources.as_slice() else {
            panic!("two resources expected");
        };
        assert_eq!(motion.resource.category, ResourceCategory::Animation);
        assert_eq!(motion.category_override, None);
        assert!(motion.tags.is_empty());
        assert_eq!(other.resource.category, ResourceCategory::Icons);
        assert_eq!(other.category_override, Some(ResourceCategory::Icons));
        assert_eq!(other.tags, ["svg"]);
        assert_eq!(other.note.as_deref(), Some("nice"));
    }

    #[test]
    fn annotation_without_a_category_keeps_the_automatic_one() {
        let annotations = Annotations::from([(
            "motion.dev".to_owned(),
            ResourceAnnotation {
                category: None,
                status: None,
                tags: vec!["fav".to_owned()],
                note: None,
            },
        )]);

        let annotated = annotate(snapshot(), &annotations, &LinkHealthMap::new());

        assert_eq!(
            annotated.resources[0].resource.category,
            ResourceCategory::Animation
        );
        assert_eq!(annotated.resources[0].tags, ["fav"]);
    }

    #[test]
    fn annotations_carry_reading_status_and_health_marks_links() {
        let annotations = Annotations::from([(
            "motion.dev".to_owned(),
            ResourceAnnotation {
                category: None,
                status: Some(ReadingStatus::ToRead),
                tags: Vec::new(),
                note: None,
            },
        )]);
        let health = LinkHealthMap::from([("other.example".to_owned(), LinkHealth::Broken)]);

        let annotated = annotate(snapshot(), &annotations, &health);

        assert_eq!(annotated.resources[0].status, Some(ReadingStatus::ToRead));
        assert_eq!(annotated.resources[0].link_health, None);
        assert_eq!(annotated.resources[1].link_health, Some(LinkHealth::Broken));
    }

    #[test]
    fn reading_statuses_serialize_kebab_case() {
        assert_eq!(
            serde_json::to_string(&ReadingStatus::ToRead).unwrap(),
            "\"to-read\""
        );
    }
}
