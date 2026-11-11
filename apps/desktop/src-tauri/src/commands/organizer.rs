use std::fmt::{Debug, Display};
use std::path::Path;

use devatlas_application::organizer::{self, Group, GroupKind, ResourceEdit};
use devatlas_storage::database::Database;
use tauri::State;

use super::library::now_ms;

/// The database. `None` when it couldn't be opened: the app still runs, without organizing.
pub struct Organizer {
    database: Option<Database>,
}

impl Organizer {
    pub async fn open(path: &Path) -> Self {
        match Database::open(path).await {
            Ok(database) => Self {
                database: Some(database),
            },
            Err(error) => {
                tracing::error!(%error, "could not open the database");
                Self { database: None }
            }
        }
    }

    pub(super) fn database(&self) -> Result<&Database, String> {
        self.database.as_ref().ok_or_else(|| {
            "DevAtlas couldn't open its database, so this isn't available right now.".to_owned()
        })
    }
}

/// Logs the full error; the UI only gets its plain message.
fn report<E: Debug + Display>(error: E) -> String {
    tracing::warn!(?error, "organizer command failed");
    error.to_string()
}

/// Saves a link's category, tags, note and groups.
#[tauri::command]
pub async fn update_resource(
    id: String,
    edit: ResourceEdit,
    organizer: State<'_, Organizer>,
) -> Result<(), String> {
    organizer::update_resource(organizer.database()?, &id, edit)
        .await
        .map_err(report)
}

/// Every collection and project.
#[tauri::command]
pub async fn list_groups(organizer: State<'_, Organizer>) -> Result<Vec<Group>, String> {
    organizer::list_groups(organizer.database()?)
        .await
        .map_err(report)
}

#[tauri::command]
pub async fn create_group(
    kind: GroupKind,
    name: String,
    description: Option<String>,
    organizer: State<'_, Organizer>,
) -> Result<Group, String> {
    organizer::create_group(
        organizer.database()?,
        kind,
        &name,
        description.as_deref(),
        now_ms(),
    )
    .await
    .map_err(report)
}

#[tauri::command]
pub async fn update_group(
    id: String,
    name: String,
    description: Option<String>,
    organizer: State<'_, Organizer>,
) -> Result<bool, String> {
    organizer::update_group(organizer.database()?, &id, &name, description.as_deref())
        .await
        .map_err(report)
}

/// Deletes a group. The links in it stay in the library.
#[tauri::command]
pub async fn delete_group(id: String, organizer: State<'_, Organizer>) -> Result<bool, String> {
    organizer::delete_group(organizer.database()?, &id)
        .await
        .map_err(report)
}

#[tauri::command]
pub async fn set_group_resources(
    id: String,
    resource_ids: Vec<String>,
    organizer: State<'_, Organizer>,
) -> Result<bool, String> {
    organizer::set_group_resources(organizer.database()?, &id, &resource_ids)
        .await
        .map_err(report)
}
