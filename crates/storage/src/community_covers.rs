//! Shared collections' covers in Supabase Storage: `collection-covers/{id}/{n}.jpg`, writable
//! only in folders named after the caller's collections (see the storage policy).

use devatlas_application::community::{MAX_COVERS, MAX_LINK_IMAGES};
use devatlas_application::community_covers::CoverStore;
use reqwest::header::{CACHE_CONTROL, CONTENT_TYPE};
use url::Url;

use crate::community::{CommunityConfig, SupabaseCommunity, SupabaseError, refusal};

pub(crate) const BUCKET: &str = "collection-covers";

fn object(collection: &str, position: usize) -> String {
    format!("{collection}/links/{position}.jpg")
}

/// The public address of the image of the link at `position`; `version` changes when the images
/// do. `None` for a position no link image can have.
pub(crate) fn image_url(
    config: &CommunityConfig,
    collection: &str,
    position: i64,
    version: Option<&str>,
) -> Option<String> {
    let position = usize::try_from(position)
        .ok()
        .filter(|position| *position < MAX_LINK_IMAGES)?;
    let path = format!(
        "storage/v1/object/public/{BUCKET}/{}",
        object(collection, position)
    );
    let mut url: Url = config.endpoint(&path).ok()?;
    if let Some(version) = version {
        url.query_pairs_mut().append_pair("v", version);
    }
    Some(url.into())
}

/// A card's covers: the first few link images.
pub(crate) fn cover_urls(
    config: &CommunityConfig,
    collection: &str,
    images: &[i64],
    version: Option<&str>,
) -> Vec<String> {
    images
        .iter()
        .filter_map(|position| image_url(config, collection, *position, version))
        .take(MAX_COVERS)
        .collect()
}

impl CoverStore for SupabaseCommunity {
    type Error = SupabaseError;

    async fn put_image(
        &self,
        collection: &str,
        position: usize,
        jpeg: &[u8],
    ) -> Result<(), SupabaseError> {
        let url = self.storage(&format!("object/{BUCKET}/{}", object(collection, position)))?;
        let sent = self
            .authed(|http| {
                http.post(url.clone())
                    .header(CONTENT_TYPE, "image/jpeg")
                    .header(CACHE_CONTROL, "max-age=3600")
                    .header("x-upsert", "true")
                    .body(jpeg.to_vec())
            })
            .await?;
        sent.map(drop)
            .map_err(|(status, body)| refusal(status, &body))
    }

    async fn set_images(&self, collection: &str, positions: &[usize]) -> Result<(), SupabaseError> {
        let url = self.rest("rpc/set_collection_images")?;
        let body = serde_json::json!({ "collection": collection, "positions": positions });
        let sent = self
            .authed(|http| {
                http.post(url.clone())
                    .header(CONTENT_TYPE, "application/json")
                    .body(body.to_string())
            })
            .await?;
        sent.map(drop)
            .map_err(|(status, body)| refusal(status, &body))
    }

    async fn delete_images(&self, collection: &str, keep: &[usize]) -> Result<(), SupabaseError> {
        let url = self.storage(&format!("object/{BUCKET}"))?;
        let prefixes = stale_objects(collection, keep);
        let body = serde_json::json!({ "prefixes": prefixes });
        let sent = self
            .authed(|http| {
                http.delete(url.clone())
                    .header(CONTENT_TYPE, "application/json")
                    .body(body.to_string())
            })
            .await?;
        sent.map(drop)
            .map_err(|(status, body)| refusal(status, &body))
    }
}

/// Every image file of a collection but those at `keep`, including the three covers that app
/// versions before link images stored as `{collection}/{0,1,2}.jpg`.
fn stale_objects(collection: &str, keep: &[usize]) -> Vec<String> {
    let images = (0..MAX_LINK_IMAGES)
        .filter(|position| !keep.contains(position))
        .map(|position| object(collection, position));
    let old_covers = (0..MAX_COVERS).map(|index| format!("{collection}/{index}.jpg"));
    images.chain(old_covers).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    const ID: &str = "0b8f4a9e-6d2c-4b1a-9f3e-2c7d5e8a1b40";

    #[test]
    fn image_addresses_point_at_this_projects_storage_and_change_with_their_version() {
        let config = CommunityConfig::new("https://x.supabase.co", "key").unwrap();
        assert_eq!(
            image_url(&config, ID, 7, Some("2026-11-15T10:00:00+00:00")).unwrap(),
            format!(
                "https://x.supabase.co/storage/v1/object/public/collection-covers/{ID}/links/7.jpg?v=2026-11-15T10%3A00%3A00%2B00%3A00"
            ),
        );
        assert_eq!(image_url(&config, ID, -1, None), None);
        assert_eq!(image_url(&config, ID, MAX_LINK_IMAGES as i64, None), None);
    }

    #[test]
    fn a_card_shows_the_first_three_link_images() {
        let config = CommunityConfig::new("https://x.supabase.co", "key").unwrap();
        let covers = cover_urls(&config, ID, &[2, 5, 6, 9], None);
        assert_eq!(covers.len(), MAX_COVERS);
        assert!(covers[0].ends_with("/links/2.jpg"));
        assert!(cover_urls(&config, ID, &[], None).is_empty());
    }

    #[test]
    fn deleting_keeps_only_the_named_images_and_drops_old_covers() {
        let stale = stale_objects(ID, &[1, 3]);
        assert!(!stale.contains(&object(ID, 1)));
        assert!(!stale.contains(&object(ID, 3)));
        assert!(stale.contains(&object(ID, 0)));
        assert!(stale.contains(&format!("{ID}/0.jpg")));
        assert_eq!(stale.len(), MAX_LINK_IMAGES - 2 + MAX_COVERS);
    }
}
