//! Backups: everything the user added, as one file. A backup is treated as untrusted input
//! when restored.

use std::future::Future;

use devatlas_domain::resource::ResourceCategory;
use serde::{Deserialize, Serialize};

use crate::library::SavedLink;
use crate::organizer::{
    Annotations, Group, InvalidInput, ReadingStatus, ResourceEdit, check_id, clean_edit,
    clean_group,
};
use crate::snippets::{Snippet, SnippetInput, clean_snippet};

pub const BACKUP_VERSION: u32 = 1;
/// Most entries accepted in any one list of a backup.
const MAX_ENTRIES: usize = 50_000;
/// Longest saved-link title or address accepted.
const MAX_LINK_TEXT: usize = 2_048;
/// Most removed links accepted; each is stored and re-read on every library load.
const MAX_HIDDEN: usize = 10_000;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupAnnotation {
    pub resource_id: String,
    pub category: Option<ResourceCategory>,
    pub status: Option<ReadingStatus>,
    pub tags: Vec<String>,
    pub note: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupGroup {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub resource_ids: Vec<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Backup {
    pub version: u32,
    pub exported_at: i64,
    pub saved_links: Vec<SavedLink>,
    /// Links removed from the library, so a restore doesn't bring them back.
    pub hidden: Vec<String>,
    pub annotations: Vec<BackupAnnotation>,
    pub groups: Vec<BackupGroup>,
    pub snippets: Vec<Snippet>,
}

/// What a restore added or updated.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSummary {
    pub links: usize,
    pub groups: usize,
    pub snippets: usize,
}

/// Port: merges a backup into the database, all or nothing. Anything not in the backup is kept,
/// and group memberships are only added to; notes, tags and snippets in the backup replace
/// the ones with the same id.
pub trait BackupStore {
    type Error: std::error::Error;

    fn restore(&self, backup: &Backup) -> impl Future<Output = Result<(), Self::Error>> + Send;
}

#[derive(Debug, thiserror::Error)]
pub enum BackupError {
    #[error("This backup was made by a newer version of DevAtlas.")]
    UnsupportedVersion,
    #[error("This backup is too large to restore.")]
    TooLarge,
    #[error("This backup contains invalid data: {0}")]
    Invalid(#[from] InvalidInput),
}

/// Assembles a backup.
pub fn build(
    saved_links: Vec<SavedLink>,
    hidden: Vec<String>,
    annotations: &Annotations,
    groups: &[Group],
    snippets: Vec<Snippet>,
    now_ms: i64,
) -> Backup {
    let mut annotations: Vec<BackupAnnotation> = annotations
        .iter()
        .map(|(id, annotation)| BackupAnnotation {
            resource_id: id.clone(),
            category: annotation.category,
            status: annotation.status,
            tags: annotation.tags.clone(),
            note: annotation.note.clone(),
        })
        .collect();
    annotations.sort_by(|a, b| a.resource_id.cmp(&b.resource_id));
    Backup {
        version: BACKUP_VERSION,
        exported_at: now_ms,
        saved_links,
        hidden,
        annotations,
        groups: groups
            .iter()
            .map(|group| BackupGroup {
                id: group.id.clone(),
                name: group.name.clone(),
                description: group.description.clone(),
                resource_ids: group.resource_ids.clone(),
                created_at: group.created_at,
            })
            .collect(),
        snippets,
    }
}

/// Validates a backup with the same rules as the UI, since the file could say anything.
pub fn clean(backup: Backup) -> Result<Backup, BackupError> {
    if backup.version > BACKUP_VERSION {
        return Err(BackupError::UnsupportedVersion);
    }
    let sizes = [
        backup.saved_links.len(),
        backup.hidden.len(),
        backup.annotations.len(),
        backup.groups.len(),
        backup.snippets.len(),
    ];
    let oversized_link = backup
        .saved_links
        .iter()
        .any(|link| link.title.len() > MAX_LINK_TEXT || link.url.len() > MAX_LINK_TEXT);
    if sizes.iter().any(|size| *size > MAX_ENTRIES)
        || backup.hidden.len() > MAX_HIDDEN
        || oversized_link
    {
        return Err(BackupError::TooLarge);
    }
    backup.hidden.iter().try_for_each(|id| check_id(id))?;

    let annotations = backup
        .annotations
        .into_iter()
        .map(|annotation| {
            check_id(&annotation.resource_id)?;
            let edit = clean_edit(ResourceEdit {
                category: annotation.category,
                status: annotation.status,
                tags: annotation.tags,
                note: annotation.note,
                group_ids: Vec::new(),
            })?;
            Ok(BackupAnnotation {
                resource_id: annotation.resource_id,
                category: edit.category,
                status: edit.status,
                tags: edit.tags,
                note: edit.note,
            })
        })
        .collect::<Result<_, InvalidInput>>()?;

    let groups = backup
        .groups
        .into_iter()
        .map(|group| {
            check_id(&group.id)?;
            group.resource_ids.iter().try_for_each(|id| check_id(id))?;
            let (name, description) = clean_group(&group.name, group.description.as_deref())?;
            Ok(BackupGroup {
                name,
                description,
                ..group
            })
        })
        .collect::<Result<_, InvalidInput>>()?;

    let snippets = backup
        .snippets
        .into_iter()
        .map(|snippet| {
            check_id(&snippet.id)?;
            let input = clean_snippet(SnippetInput {
                title: snippet.title,
                language: snippet.language,
                code: snippet.code,
                tags: snippet.tags,
                resource_id: snippet.resource_id,
            })?;
            Ok(Snippet {
                id: snippet.id,
                title: input.title,
                language: input.language,
                code: input.code,
                tags: input.tags,
                resource_id: input.resource_id,
                created_at: snippet.created_at,
                updated_at: snippet.updated_at,
            })
        })
        .collect::<Result<_, InvalidInput>>()?;

    Ok(Backup {
        annotations,
        groups,
        snippets,
        ..backup
    })
}

#[cfg(test)]
mod tests {
    use devatlas_domain::resource::ResourceCategory;

    use super::*;
    use crate::organizer::{Group, ReadingStatus, ResourceAnnotation};

    fn group() -> Group {
        Group {
            id: "g1".to_owned(),
            name: "Site".to_owned(),
            description: None,
            resource_ids: vec!["a.example".to_owned()],
            created_at: 1,
        }
    }

    fn sample() -> Backup {
        let annotations = Annotations::from([(
            "a.example".to_owned(),
            ResourceAnnotation {
                category: Some(ResourceCategory::Icons),
                status: Some(ReadingStatus::Using),
                tags: vec!["t".to_owned()],
                note: Some("n".to_owned()),
            },
        )]);
        build(
            Vec::new(),
            vec!["h".to_owned()],
            &annotations,
            &[group()],
            Vec::new(),
            9,
        )
    }

    #[test]
    fn builds_a_versioned_backup() {
        let backup = sample();

        assert_eq!(backup.version, BACKUP_VERSION);
        assert_eq!(backup.exported_at, 9);
        assert_eq!(backup.annotations[0].resource_id, "a.example");
        assert_eq!(backup.annotations[0].status, Some(ReadingStatus::Using));
        assert_eq!(backup.hidden, ["h"]);
    }

    #[test]
    fn round_trips_through_json() {
        let json = serde_json::to_string(&sample()).unwrap();

        let parsed: Backup = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed, sample());
    }

    #[test]
    fn accepts_a_valid_backup() {
        assert_eq!(clean(sample()).unwrap(), sample());
    }

    #[test]
    fn reads_a_backup_made_when_projects_existed() {
        let json = r#"{"version":1,"exportedAt":1,"savedLinks":[],"hidden":[],"annotations":[],
            "groups":[{"id":"g1","kind":"project","name":"Site","description":null,
            "resourceIds":[],"createdAt":1}],
            "snippets":[{"id":"s1","title":"T","language":null,"code":"x","tags":[],
            "resourceId":null,"groupId":"g1","createdAt":1,"updatedAt":1}]}"#;

        let backup: Backup = serde_json::from_str(json).unwrap();

        assert_eq!(backup.groups[0].name, "Site");
        assert_eq!(backup.snippets[0].title, "T");
    }

    #[test]
    fn refuses_a_newer_backup_version() {
        let backup = Backup {
            version: BACKUP_VERSION + 1,
            ..sample()
        };

        assert!(matches!(
            clean(backup),
            Err(BackupError::UnsupportedVersion)
        ));
    }

    #[test]
    fn refuses_invalid_content() {
        let mut backup = sample();
        backup.groups[0].name = "  ".to_owned();

        assert!(matches!(clean(backup), Err(BackupError::Invalid(_))));
    }

    #[test]
    fn refuses_oversized_saved_links() {
        let mut backup = sample();
        backup.saved_links = vec![SavedLink {
            url: "https://a.example/".to_owned(),
            title: "x".repeat(MAX_LINK_TEXT + 1),
            added_at: 1,
        }];

        assert!(matches!(clean(backup), Err(BackupError::TooLarge)));
    }

    #[test]
    fn refuses_too_many_hidden_links() {
        let mut backup = sample();
        backup.hidden = vec!["h".to_owned(); MAX_HIDDEN + 1];

        assert!(matches!(clean(backup), Err(BackupError::TooLarge)));
    }

    #[test]
    fn refuses_a_backup_with_too_many_entries() {
        let mut backup = sample();
        backup.annotations = vec![backup.annotations[0].clone(); MAX_ENTRIES + 1];

        assert!(matches!(clean(backup), Err(BackupError::TooLarge)));
    }
}
