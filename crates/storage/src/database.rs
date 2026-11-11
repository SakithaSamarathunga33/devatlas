//! The SQLite database: annotations, groups and repository history. Migrations are embedded
//! and applied on open. All queries bind their values; none are built from strings.

use std::collections::HashMap;
use std::path::Path;

use devatlas_application::backup::{Backup, BackupStore};
use devatlas_application::discovery::{RepoHistoryStore, RepoRelease};
use devatlas_application::link_health::{LinkHealth, LinkHealthMap, LinkHealthStore};
use devatlas_application::organizer::{
    Annotations, Group, OrganizerStore, ReadingStatus, ResourceAnnotation,
};
use devatlas_application::snippets::{Snippet, SnippetInput, SnippetStore};
use devatlas_application::suggestions::SuggestionStore;
use devatlas_domain::resource::ResourceCategory;
use sqlx::Row;
use sqlx::sqlite::{
    SqliteConnectOptions, SqliteJournalMode, SqlitePool, SqlitePoolOptions, SqliteRow,
};
use uuid::Uuid;

/// Star counts older than this are deleted; growth only looks back a week.
const STAR_HISTORY_DAYS: i64 = 30;
const MAX_CONNECTIONS: u32 = 4;

#[derive(Debug, thiserror::Error)]
pub enum DatabaseError {
    #[error("the database could not be opened: {0}")]
    Open(#[from] sqlx::Error),
    #[error("the database could not be updated: {0}")]
    Migrate(#[from] sqlx::migrate::MigrateError),
    #[error("the database folder could not be created: {0}")]
    Folder(#[from] std::io::Error),
}

pub struct Database {
    pool: SqlitePool,
}

impl Database {
    /// Opens the database file, creating it and its folder if needed.
    pub async fn open(path: &Path) -> Result<Self, DatabaseError> {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir)?;
        }
        let options = SqliteConnectOptions::new()
            .filename(path)
            .create_if_missing(true)
            .journal_mode(SqliteJournalMode::Wal)
            .foreign_keys(true);
        let pool = SqlitePoolOptions::new()
            .max_connections(MAX_CONNECTIONS)
            .connect_with(options)
            .await?;
        Self::migrated(pool).await
    }

    async fn migrated(pool: SqlitePool) -> Result<Self, DatabaseError> {
        let mut migrator = sqlx::migrate!();
        // An older build opening a database touched by a newer one should still start.
        migrator.set_ignore_missing(true);
        migrator.run(&pool).await?;
        Ok(Self { pool })
    }

    #[cfg(test)]
    async fn in_memory() -> Result<Self, DatabaseError> {
        // One connection: each new connection to `:memory:` would be a separate database.
        let options = SqliteConnectOptions::new()
            .in_memory(true)
            .foreign_keys(true);
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(options)
            .await?;
        Self::migrated(pool).await
    }
}

fn category_text(category: ResourceCategory) -> Option<String> {
    serde_json::to_value(category)
        .ok()?
        .as_str()
        .map(str::to_owned)
}

/// An unknown stored value falls back to the automatic category.
fn parse_category(text: Option<String>) -> Option<ResourceCategory> {
    serde_json::from_value(serde_json::Value::String(text?)).ok()
}

fn as_signed(stars: u64) -> i64 {
    i64::try_from(stars).unwrap_or(i64::MAX)
}

impl OrganizerStore for Database {
    type Error = sqlx::Error;

    async fn annotations(&self) -> Result<Annotations, sqlx::Error> {
        let mut annotations = Annotations::new();
        let rows =
            sqlx::query("SELECT resource_id, category, status, note FROM resource_annotations")
                .fetch_all(&self.pool)
                .await?;
        for row in rows {
            annotations.insert(
                row.try_get("resource_id")?,
                ResourceAnnotation {
                    category: parse_category(row.try_get("category")?),
                    status: row
                        .try_get::<Option<String>, _>("status")?
                        .as_deref()
                        .and_then(ReadingStatus::parse),
                    tags: Vec::new(),
                    note: row.try_get("note")?,
                },
            );
        }
        let tags = sqlx::query("SELECT resource_id, tag FROM resource_tags ORDER BY position")
            .fetch_all(&self.pool)
            .await?;
        for row in tags {
            let id: String = row.try_get("resource_id")?;
            if let Some(annotation) = annotations.get_mut(&id) {
                annotation.tags.push(row.try_get("tag")?);
            }
        }
        Ok(annotations)
    }

    async fn save_resource(
        &self,
        id: &str,
        annotation: &ResourceAnnotation,
        group_ids: &[String],
    ) -> Result<(), sqlx::Error> {
        let mut tx = self.pool.begin().await?;
        sqlx::query(
            "INSERT INTO resource_annotations (resource_id, category, status, note)
             VALUES (?, ?, ?, ?)
             ON CONFLICT (resource_id) DO UPDATE SET category = excluded.category,
             status = excluded.status, note = excluded.note",
        )
        .bind(id)
        .bind(annotation.category.and_then(category_text))
        .bind(annotation.status.map(ReadingStatus::as_str))
        .bind(annotation.note.as_deref())
        .execute(&mut *tx)
        .await?;

        sqlx::query("DELETE FROM resource_tags WHERE resource_id = ?")
            .bind(id)
            .execute(&mut *tx)
            .await?;
        for (position, tag) in annotation.tags.iter().enumerate() {
            sqlx::query("INSERT INTO resource_tags (resource_id, tag, position) VALUES (?, ?, ?)")
                .bind(id)
                .bind(tag)
                .bind(i64::try_from(position).unwrap_or(i64::MAX))
                .execute(&mut *tx)
                .await?;
        }

        sqlx::query("DELETE FROM group_resources WHERE resource_id = ?")
            .bind(id)
            .execute(&mut *tx)
            .await?;
        for group_id in group_ids {
            // Selecting from the groups skips one deleted while the edit was open.
            sqlx::query(
                "INSERT OR IGNORE INTO group_resources (group_id, resource_id)
                 SELECT id, ? FROM link_groups WHERE id = ?",
            )
            .bind(id)
            .bind(group_id)
            .execute(&mut *tx)
            .await?;
        }
        tx.commit().await
    }

    async fn groups(&self) -> Result<Vec<Group>, sqlx::Error> {
        let mut members: HashMap<String, Vec<String>> = HashMap::new();
        let rows = sqlx::query("SELECT group_id, resource_id FROM group_resources ORDER BY rowid")
            .fetch_all(&self.pool)
            .await?;
        for row in rows {
            members
                .entry(row.try_get("group_id")?)
                .or_default()
                .push(row.try_get("resource_id")?);
        }

        let rows = sqlx::query(
            "SELECT id, name, description, created_at
             FROM link_groups ORDER BY created_at, rowid",
        )
        .fetch_all(&self.pool)
        .await?;
        rows.into_iter()
            .map(|row| {
                let id: String = row.try_get("id")?;
                Ok(Group {
                    resource_ids: members.remove(&id).unwrap_or_default(),
                    id,
                    name: row.try_get("name")?,
                    description: row.try_get("description")?,
                    created_at: row.try_get("created_at")?,
                })
            })
            .collect()
    }

    async fn create_group(
        &self,
        name: &str,
        description: Option<&str>,
        now_ms: i64,
    ) -> Result<Group, sqlx::Error> {
        let id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO link_groups (id, kind, name, description, created_at)
             VALUES (?, 'collection', ?, ?, ?)",
        )
        .bind(&id)
        .bind(name)
        .bind(description)
        .bind(now_ms)
        .execute(&self.pool)
        .await?;
        Ok(Group {
            id,
            name: name.to_owned(),
            description: description.map(str::to_owned),
            resource_ids: Vec::new(),
            created_at: now_ms,
        })
    }

    async fn update_group(
        &self,
        id: &str,
        name: &str,
        description: Option<&str>,
    ) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("UPDATE link_groups SET name = ?, description = ? WHERE id = ?")
            .bind(name)
            .bind(description)
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    async fn delete_group(&self, id: &str) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM link_groups WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    async fn set_group_resources(
        &self,
        id: &str,
        resource_ids: &[String],
    ) -> Result<bool, sqlx::Error> {
        // IMMEDIATE: reading first then writing in a deferred transaction fails at once, with
        // no busy wait, if another connection commits in between.
        let mut tx = self.pool.begin_with("BEGIN IMMEDIATE").await?;
        let exists = sqlx::query("SELECT 1 FROM link_groups WHERE id = ?")
            .bind(id)
            .fetch_optional(&mut *tx)
            .await?
            .is_some();
        if !exists {
            return Ok(false);
        }
        sqlx::query("DELETE FROM group_resources WHERE group_id = ?")
            .bind(id)
            .execute(&mut *tx)
            .await?;
        for resource_id in resource_ids {
            sqlx::query(
                "INSERT OR IGNORE INTO group_resources (group_id, resource_id) VALUES (?, ?)",
            )
            .bind(id)
            .bind(resource_id)
            .execute(&mut *tx)
            .await?;
        }
        tx.commit().await?;
        Ok(true)
    }
}

fn tags_text(tags: &[String]) -> Result<String, sqlx::Error> {
    serde_json::to_string(tags).map_err(|error| sqlx::Error::Encode(Box::new(error)))
}

fn parse_snippet(row: &SqliteRow) -> Result<Snippet, sqlx::Error> {
    let tags: String = row.try_get("tags")?;
    Ok(Snippet {
        id: row.try_get("id")?,
        title: row.try_get("title")?,
        language: row.try_get("language")?,
        code: row.try_get("code")?,
        tags: serde_json::from_str(&tags).unwrap_or_default(),
        resource_id: row.try_get("resource_id")?,
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
    })
}

impl SnippetStore for Database {
    type Error = sqlx::Error;

    async fn snippets(&self) -> Result<Vec<Snippet>, sqlx::Error> {
        sqlx::query("SELECT * FROM snippets ORDER BY updated_at DESC, rowid DESC")
            .fetch_all(&self.pool)
            .await?
            .iter()
            .map(parse_snippet)
            .collect()
    }

    async fn create_snippet(
        &self,
        input: &SnippetInput,
        now_ms: i64,
    ) -> Result<Snippet, sqlx::Error> {
        let id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO snippets
             (id, title, language, code, tags, resource_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&input.title)
        .bind(input.language.as_deref())
        .bind(&input.code)
        .bind(tags_text(&input.tags)?)
        .bind(input.resource_id.as_deref())
        .bind(now_ms)
        .bind(now_ms)
        .execute(&self.pool)
        .await?;
        Ok(Snippet {
            id,
            title: input.title.clone(),
            language: input.language.clone(),
            code: input.code.clone(),
            tags: input.tags.clone(),
            resource_id: input.resource_id.clone(),
            created_at: now_ms,
            updated_at: now_ms,
        })
    }

    async fn update_snippet(
        &self,
        id: &str,
        input: &SnippetInput,
        now_ms: i64,
    ) -> Result<bool, sqlx::Error> {
        let result = sqlx::query(
            "UPDATE snippets SET title = ?, language = ?, code = ?, tags = ?, resource_id = ?,
             updated_at = ? WHERE id = ?",
        )
        .bind(&input.title)
        .bind(input.language.as_deref())
        .bind(&input.code)
        .bind(tags_text(&input.tags)?)
        .bind(input.resource_id.as_deref())
        .bind(now_ms)
        .bind(id)
        .execute(&self.pool)
        .await?;
        Ok(result.rows_affected() > 0)
    }

    async fn delete_snippet(&self, id: &str) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM snippets WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }
}

impl SuggestionStore for Database {
    type Error = sqlx::Error;

    async fn removed_suggestions(&self) -> Result<Vec<String>, sqlx::Error> {
        let rows = sqlx::query("SELECT id FROM removed_suggestions ORDER BY id")
            .fetch_all(&self.pool)
            .await?;
        rows.iter().map(|row| row.try_get("id")).collect()
    }

    async fn remove_suggestion(&self, id: &str) -> Result<(), sqlx::Error> {
        sqlx::query("INSERT OR IGNORE INTO removed_suggestions (id) VALUES (?)")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    async fn restore_suggestions(&self, ids: &[String]) -> Result<(), sqlx::Error> {
        let mut tx = self.pool.begin().await?;
        for id in ids {
            sqlx::query("DELETE FROM removed_suggestions WHERE id = ?")
                .bind(id)
                .execute(&mut *tx)
                .await?;
        }
        tx.commit().await
    }
}

impl LinkHealthStore for Database {
    type Error = sqlx::Error;

    async fn link_health(&self) -> Result<LinkHealthMap, sqlx::Error> {
        let rows = sqlx::query("SELECT resource_id, health FROM link_checks")
            .fetch_all(&self.pool)
            .await?;
        let mut health = LinkHealthMap::new();
        for row in rows {
            let text: String = row.try_get("health")?;
            if let Some(verdict) = LinkHealth::parse(&text) {
                health.insert(row.try_get("resource_id")?, verdict);
            }
        }
        Ok(health)
    }

    async fn save_link_health(
        &self,
        results: &[(String, LinkHealth)],
        checked_at: i64,
    ) -> Result<(), sqlx::Error> {
        let mut tx = self.pool.begin().await?;
        for (id, health) in results {
            sqlx::query(
                "INSERT OR REPLACE INTO link_checks (resource_id, health, checked_at)
                 VALUES (?, ?, ?)",
            )
            .bind(id)
            .bind(health.as_str())
            .bind(checked_at)
            .execute(&mut *tx)
            .await?;
        }
        tx.commit().await
    }
}

impl BackupStore for Database {
    type Error = sqlx::Error;

    async fn restore(&self, backup: &Backup) -> Result<(), sqlx::Error> {
        let mut tx = self.pool.begin_with("BEGIN IMMEDIATE").await?;
        for annotation in &backup.annotations {
            sqlx::query(
                "INSERT INTO resource_annotations (resource_id, category, status, note)
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT (resource_id) DO UPDATE SET category = excluded.category,
                 status = excluded.status, note = excluded.note",
            )
            .bind(&annotation.resource_id)
            .bind(annotation.category.and_then(category_text))
            .bind(annotation.status.map(ReadingStatus::as_str))
            .bind(annotation.note.as_deref())
            .execute(&mut *tx)
            .await?;
            sqlx::query("DELETE FROM resource_tags WHERE resource_id = ?")
                .bind(&annotation.resource_id)
                .execute(&mut *tx)
                .await?;
            for (position, tag) in annotation.tags.iter().enumerate() {
                sqlx::query(
                    "INSERT INTO resource_tags (resource_id, tag, position) VALUES (?, ?, ?)",
                )
                .bind(&annotation.resource_id)
                .bind(tag)
                .bind(i64::try_from(position).unwrap_or(i64::MAX))
                .execute(&mut *tx)
                .await?;
            }
        }
        // An upsert rather than REPLACE, which would cascade-delete the memberships.
        for group in &backup.groups {
            sqlx::query(
                "INSERT INTO link_groups (id, kind, name, description, created_at)
                 VALUES (?, 'collection', ?, ?, ?)
                 ON CONFLICT (id) DO UPDATE SET name = excluded.name,
                 description = excluded.description",
            )
            .bind(&group.id)
            .bind(&group.name)
            .bind(group.description.as_deref())
            .bind(group.created_at)
            .execute(&mut *tx)
            .await?;
            for resource_id in &group.resource_ids {
                sqlx::query(
                    "INSERT OR IGNORE INTO group_resources (group_id, resource_id) VALUES (?, ?)",
                )
                .bind(&group.id)
                .bind(resource_id)
                .execute(&mut *tx)
                .await?;
            }
        }
        for snippet in &backup.snippets {
            sqlx::query(
                "INSERT INTO snippets
                 (id, title, language, code, tags, resource_id, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT (id) DO UPDATE SET title = excluded.title,
                 language = excluded.language, code = excluded.code, tags = excluded.tags,
                 resource_id = excluded.resource_id, updated_at = excluded.updated_at",
            )
            .bind(&snippet.id)
            .bind(&snippet.title)
            .bind(snippet.language.as_deref())
            .bind(&snippet.code)
            .bind(tags_text(&snippet.tags)?)
            .bind(snippet.resource_id.as_deref())
            .bind(snippet.created_at)
            .bind(snippet.updated_at)
            .execute(&mut *tx)
            .await?;
        }
        tx.commit().await
    }
}

impl RepoHistoryStore for Database {
    type Error = sqlx::Error;

    async fn release_check(
        &self,
        full_name: &str,
    ) -> Result<Option<(i64, Option<RepoRelease>)>, sqlx::Error> {
        let row = sqlx::query(
            "SELECT checked_at, tag, name, url, published_at
             FROM repo_release_checks WHERE full_name = ?",
        )
        .bind(full_name)
        .fetch_optional(&self.pool)
        .await?;
        let Some(row) = row else {
            return Ok(None);
        };
        let tag: Option<String> = row.try_get("tag")?;
        let url: Option<String> = row.try_get("url")?;
        let published_at: Option<String> = row.try_get("published_at")?;
        let release = match (tag, url, published_at) {
            (Some(tag), Some(url), Some(published_at)) => Some(RepoRelease {
                tag,
                name: row.try_get("name")?,
                url,
                published_at,
            }),
            _ => None,
        };
        Ok(Some((row.try_get("checked_at")?, release)))
    }

    async fn save_release_check(
        &self,
        full_name: &str,
        checked_at: i64,
        release: Option<&RepoRelease>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT OR REPLACE INTO repo_release_checks
             (full_name, checked_at, tag, name, url, published_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(full_name)
        .bind(checked_at)
        .bind(release.map(|release| release.tag.as_str()))
        .bind(release.and_then(|release| release.name.as_deref()))
        .bind(release.map(|release| release.url.as_str()))
        .bind(release.map(|release| release.published_at.as_str()))
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn record_stars(&self, full_name: &str, day: i64, stars: u64) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT OR REPLACE INTO repo_star_snapshots (full_name, day, stars) VALUES (?, ?, ?)",
        )
        .bind(full_name)
        .bind(day)
        .bind(as_signed(stars))
        .execute(&self.pool)
        .await?;
        sqlx::query("DELETE FROM repo_star_snapshots WHERE full_name = ? AND day < ?")
            .bind(full_name)
            .bind(day - STAR_HISTORY_DAYS)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    async fn stars_since(
        &self,
        full_name: &str,
        earliest_day: i64,
    ) -> Result<Option<(i64, u64)>, sqlx::Error> {
        let row = sqlx::query(
            "SELECT day, stars FROM repo_star_snapshots
             WHERE full_name = ? AND day >= ? ORDER BY day LIMIT 1",
        )
        .bind(full_name)
        .bind(earliest_day)
        .fetch_optional(&self.pool)
        .await?;
        row.map(|row| {
            let stars: i64 = row.try_get("stars")?;
            Ok((row.try_get("day")?, u64::try_from(stars).unwrap_or(0)))
        })
        .transpose()
    }
}

#[cfg(test)]
mod tests {
    use devatlas_application::backup::{BackupAnnotation, BackupGroup};
    use devatlas_application::discovery::RepoRelease;
    use devatlas_domain::resource::ResourceCategory;

    use super::*;

    fn annotation(tags: &[&str], note: Option<&str>) -> ResourceAnnotation {
        ResourceAnnotation {
            category: Some(ResourceCategory::Icons),
            status: None,
            tags: tags.iter().map(|tag| (*tag).to_owned()).collect(),
            note: note.map(str::to_owned),
        }
    }

    #[tokio::test]
    async fn round_trips_annotations_keeping_tag_order() {
        let db = Database::in_memory().await.unwrap();

        db.save_resource("a.example", &annotation(&["z", "a"], Some("hi")), &[])
            .await
            .unwrap();

        let all = db.annotations().await.unwrap();
        assert_eq!(all["a.example"], annotation(&["z", "a"], Some("hi")));
    }

    #[tokio::test]
    async fn saving_replaces_earlier_tags_and_note() {
        let db = Database::in_memory().await.unwrap();
        db.save_resource("a.example", &annotation(&["old"], Some("old")), &[])
            .await
            .unwrap();

        let cleared = ResourceAnnotation {
            category: None,
            status: None,
            tags: vec!["new".to_owned()],
            note: None,
        };
        db.save_resource("a.example", &cleared, &[]).await.unwrap();

        assert_eq!(db.annotations().await.unwrap()["a.example"], cleared);
    }

    #[tokio::test]
    async fn creates_lists_and_renames_groups() {
        let db = Database::in_memory().await.unwrap();

        let created = db.create_group("Site", Some("Client"), 5).await.unwrap();
        assert!(db.update_group(&created.id, "Website", None).await.unwrap());

        let groups = db.groups().await.unwrap();
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].name, "Website");
        assert_eq!(groups[0].description, None);
        assert_eq!(groups[0].created_at, 5);
        assert!(!db.update_group("missing", "x", None).await.unwrap());
    }

    #[tokio::test]
    async fn group_ids_are_unique() {
        let db = Database::in_memory().await.unwrap();

        let a = db.create_group("A", None, 1).await;
        let b = db.create_group("A", None, 1).await;

        assert_ne!(a.unwrap().id, b.unwrap().id);
    }

    #[tokio::test]
    async fn replaces_a_groups_links() {
        let db = Database::in_memory().await.unwrap();
        let group = db.create_group("A", None, 1).await.unwrap();
        let ids = |list: &[&str]| list.iter().map(|id| (*id).to_owned()).collect::<Vec<_>>();

        assert!(
            db.set_group_resources(&group.id, &ids(&["a", "b"]))
                .await
                .unwrap()
        );
        assert!(
            db.set_group_resources(&group.id, &ids(&["b", "c"]))
                .await
                .unwrap()
        );

        assert_eq!(db.groups().await.unwrap()[0].resource_ids, ["b", "c"]);
        assert!(!db.set_group_resources("missing", &[]).await.unwrap());
    }

    #[tokio::test]
    async fn saving_a_link_sets_exactly_its_groups_and_skips_deleted_ones() {
        let db = Database::in_memory().await.unwrap();
        let a = db.create_group("A", None, 1).await.unwrap();
        let b = db.create_group("B", None, 2).await.unwrap();
        db.save_resource("x", &annotation(&[], None), std::slice::from_ref(&a.id))
            .await
            .unwrap();

        db.save_resource(
            "x",
            &annotation(&[], None),
            &[b.id.clone(), "deleted".to_owned()],
        )
        .await
        .unwrap();

        let groups = db.groups().await.unwrap();
        assert!(groups[0].resource_ids.is_empty(), "left group A");
        assert_eq!(groups[1].resource_ids, ["x"]);
    }

    #[tokio::test]
    async fn deleting_a_group_removes_its_memberships_but_not_annotations() {
        let db = Database::in_memory().await.unwrap();
        let group = db.create_group("A", None, 1).await.unwrap();
        db.save_resource(
            "x",
            &annotation(&["t"], None),
            std::slice::from_ref(&group.id),
        )
        .await
        .unwrap();

        assert!(db.delete_group(&group.id).await.unwrap());
        assert!(!db.delete_group(&group.id).await.unwrap());

        assert!(db.groups().await.unwrap().is_empty());
        assert_eq!(db.annotations().await.unwrap()["x"].tags, ["t"]);
        let orphans: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM group_resources")
            .fetch_one(&db.pool)
            .await
            .unwrap();
        assert_eq!(orphans, 0);
    }

    #[tokio::test]
    async fn remembers_release_checks_including_no_release() {
        let db = Database::in_memory().await.unwrap();
        let release = RepoRelease {
            tag: "v1".to_owned(),
            name: None,
            url: "https://github.com/a/b/releases/tag/v1".to_owned(),
            published_at: "2026-11-09T10:00:00Z".to_owned(),
        };
        assert_eq!(db.release_check("a/b").await.unwrap(), None);

        db.save_release_check("a/b", 10, Some(&release))
            .await
            .unwrap();
        assert_eq!(
            db.release_check("a/b").await.unwrap(),
            Some((10, Some(release)))
        );

        db.save_release_check("a/b", 20, None).await.unwrap();
        assert_eq!(db.release_check("a/b").await.unwrap(), Some((20, None)));
    }

    #[tokio::test]
    async fn keeps_one_star_count_per_day_and_finds_the_oldest_in_range() {
        let db = Database::in_memory().await.unwrap();
        db.record_stars("a/b", 100, 1).await.unwrap();
        db.record_stars("a/b", 103, 5).await.unwrap();
        db.record_stars("a/b", 103, 6).await.unwrap();

        assert_eq!(db.stars_since("a/b", 90).await.unwrap(), Some((100, 1)));
        assert_eq!(db.stars_since("a/b", 101).await.unwrap(), Some((103, 6)));
        assert_eq!(db.stars_since("a/b", 104).await.unwrap(), None);
        assert_eq!(db.stars_since("other/x", 0).await.unwrap(), None);
    }

    #[tokio::test]
    async fn prunes_star_counts_older_than_a_month() {
        let db = Database::in_memory().await.unwrap();
        db.record_stars("a/b", 100, 1).await.unwrap();

        db.record_stars("a/b", 100 + STAR_HISTORY_DAYS + 1, 2)
            .await
            .unwrap();

        assert_eq!(
            db.stars_since("a/b", 0).await.unwrap(),
            Some((100 + STAR_HISTORY_DAYS + 1, 2))
        );
    }

    fn snippet_input(title: &str) -> SnippetInput {
        SnippetInput {
            title: title.to_owned(),
            language: Some("Rust".to_owned()),
            code: "fn main() {}".to_owned(),
            tags: vec!["a".to_owned(), "b".to_owned()],
            resource_id: Some("x".to_owned()),
        }
    }

    #[tokio::test]
    async fn round_trips_reading_status() {
        let db = Database::in_memory().await.unwrap();
        let saved = ResourceAnnotation {
            status: Some(ReadingStatus::Trying),
            ..annotation(&[], None)
        };

        db.save_resource("x", &saved, &[]).await.unwrap();

        assert_eq!(db.annotations().await.unwrap()["x"], saved);
    }

    #[tokio::test]
    async fn creates_updates_and_deletes_snippets() {
        let db = Database::in_memory().await.unwrap();

        let created = db.create_snippet(&snippet_input("A"), 5).await.unwrap();
        assert_eq!(created.tags, ["a", "b"]);
        assert!(
            db.update_snippet(&created.id, &snippet_input("B"), 9)
                .await
                .unwrap()
        );

        let all = db.snippets().await.unwrap();
        assert_eq!(all[0].title, "B");
        assert_eq!(all[0].created_at, 5);
        assert_eq!(all[0].updated_at, 9);
        assert!(db.delete_snippet(&created.id).await.unwrap());
        assert!(!db.delete_snippet(&created.id).await.unwrap());
    }

    #[tokio::test]
    async fn removing_projects_keeps_them_as_collections() {
        let db = Database::in_memory().await.unwrap();
        sqlx::query(
            "INSERT INTO link_groups (id, kind, name, created_at, folder)
             VALUES ('p1', 'project', 'Site', 1, 'C:/site')",
        )
        .execute(&db.pool)
        .await
        .unwrap();

        sqlx::raw_sql(include_str!("../migrations/0004_remove_projects.sql"))
            .execute(&db.pool)
            .await
            .unwrap();

        let row = sqlx::query("SELECT kind, folder FROM link_groups WHERE id = 'p1'")
            .fetch_one(&db.pool)
            .await
            .unwrap();
        assert_eq!(row.get::<String, _>("kind"), "collection");
        assert_eq!(row.get::<Option<String>, _>("folder"), None);
    }

    #[tokio::test]
    async fn remembers_removed_suggestions_until_restored() {
        let db = Database::in_memory().await.unwrap();

        db.remove_suggestion("docs.rs").await.unwrap();
        db.remove_suggestion("docs.rs").await.unwrap();
        db.remove_suggestion("go.dev/tour").await.unwrap();
        assert_eq!(
            db.removed_suggestions().await.unwrap(),
            ["docs.rs", "go.dev/tour"]
        );

        db.restore_suggestions(&["docs.rs".to_owned()])
            .await
            .unwrap();
        assert_eq!(db.removed_suggestions().await.unwrap(), ["go.dev/tour"]);
    }

    #[tokio::test]
    async fn stores_the_latest_link_verdict() {
        let db = Database::in_memory().await.unwrap();

        db.save_link_health(&[("a".to_owned(), LinkHealth::Broken)], 1)
            .await
            .unwrap();
        db.save_link_health(&[("a".to_owned(), LinkHealth::Ok)], 2)
            .await
            .unwrap();

        assert_eq!(db.link_health().await.unwrap()["a"], LinkHealth::Ok);
    }

    fn restored_backup(groups: Vec<BackupGroup>, snippets: Vec<Snippet>) -> Backup {
        Backup {
            version: 1,
            exported_at: 1,
            saved_links: Vec::new(),
            hidden: Vec::new(),
            annotations: vec![BackupAnnotation {
                resource_id: "x".to_owned(),
                category: None,
                status: Some(ReadingStatus::Using),
                tags: vec!["t".to_owned()],
                note: Some("restored".to_owned()),
            }],
            groups,
            snippets,
        }
    }

    fn backup_group(id: &str, members: &[&str]) -> BackupGroup {
        BackupGroup {
            id: id.to_owned(),
            name: "From backup".to_owned(),
            description: None,
            resource_ids: members.iter().map(|id| (*id).to_owned()).collect(),
            created_at: 1,
        }
    }

    #[tokio::test]
    async fn restoring_merges_without_dropping_existing_members() {
        let db = Database::in_memory().await.unwrap();
        let group = db.create_group("Old", None, 1).await.unwrap();
        db.set_group_resources(&group.id, &["kept".to_owned()])
            .await
            .unwrap();

        db.restore(&restored_backup(
            vec![backup_group(&group.id, &["new"])],
            Vec::new(),
        ))
        .await
        .unwrap();

        let groups = db.groups().await.unwrap();
        assert_eq!(groups[0].name, "From backup");
        assert_eq!(groups[0].resource_ids, ["kept", "new"]);
        assert_eq!(
            db.annotations().await.unwrap()["x"].note.as_deref(),
            Some("restored")
        );
    }

    #[tokio::test]
    async fn opens_a_file_creating_its_folder_and_keeps_data() {
        let dir = std::env::temp_dir().join(format!("devatlas-db-test-{}", std::process::id()));
        let path = dir.join("nested").join("devatlas.db");
        {
            let db = Database::open(&path).await.unwrap();
            db.create_group("Kept", None, 1).await.unwrap();
            db.pool.close().await;
        }

        let reopened = Database::open(&path).await.unwrap();

        assert_eq!(reopened.groups().await.unwrap()[0].name, "Kept");
        reopened.pool.close().await;
        std::fs::remove_dir_all(dir).unwrap();
    }
}
