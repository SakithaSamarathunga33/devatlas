//! Shared collections' covers in Supabase Storage: `collection-covers/{id}/{n}.jpg`, writable
//! only in folders named after the caller's collections (see the storage policy).

use devatlas_application::community::MAX_COVERS;
use devatlas_application::community_covers::CoverStore;
use reqwest::header::{CACHE_CONTROL, CONTENT_TYPE};
use url::Url;

use crate::community::{CommunityConfig, SupabaseCommunity, SupabaseError, refusal};

pub(crate) const BUCKET: &str = "collection-covers";

fn object(collection: &str, index: usize) -> String {
    format!("{collection}/{index}.jpg")
}

/// The public addresses of a collection's covers; `version` changes when they do.
pub(crate) fn cover_urls(
    config: &CommunityConfig,
    collection: &str,
    count: i64,
    version: Option<&str>,
) -> Vec<String> {
    let count = usize::try_from(count.clamp(0, MAX_COVERS as i64)).unwrap_or(0);
    (0..count)
        .filter_map(|index| {
            let path = format!(
                "storage/v1/object/public/{BUCKET}/{}",
                object(collection, index)
            );
            let mut url: Url = config.endpoint(&path).ok()?;
            if let Some(version) = version {
                url.query_pairs_mut().append_pair("v", version);
            }
            Some(url.into())
        })
        .collect()
}

impl CoverStore for SupabaseCommunity {
    type Error = SupabaseError;

    async fn put_cover(
        &self,
        collection: &str,
        index: usize,
        jpeg: &[u8],
    ) -> Result<(), SupabaseError> {
        let url = self.storage(&format!("object/{BUCKET}/{}", object(collection, index)))?;
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

    async fn set_covers(&self, collection: &str, count: usize) -> Result<(), SupabaseError> {
        let url = self.rest("rpc/set_collection_covers")?;
        let body = serde_json::json!({ "collection": collection, "cover_count": count });
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

    async fn delete_covers(&self, collection: &str, from: usize) -> Result<(), SupabaseError> {
        let url = self.storage(&format!("object/{BUCKET}"))?;
        let prefixes: Vec<String> = (from..MAX_COVERS)
            .map(|index| object(collection, index))
            .collect();
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

#[cfg(test)]
mod tests {
    use super::*;

    const ID: &str = "0b8f4a9e-6d2c-4b1a-9f3e-2c7d5e8a1b40";

    #[test]
    fn cover_addresses_point_at_this_projects_storage_and_change_with_their_version() {
        let config = CommunityConfig::new("https://x.supabase.co", "key").unwrap();
        assert_eq!(
            cover_urls(&config, ID, 2, Some("2026-11-15T10:00:00+00:00")),
            [
                format!(
                    "https://x.supabase.co/storage/v1/object/public/collection-covers/{ID}/0.jpg?v=2026-11-15T10%3A00%3A00%2B00%3A00"
                ),
                format!(
                    "https://x.supabase.co/storage/v1/object/public/collection-covers/{ID}/1.jpg?v=2026-11-15T10%3A00%3A00%2B00%3A00"
                ),
            ]
        );
        assert!(cover_urls(&config, ID, 0, None).is_empty());
        assert_eq!(cover_urls(&config, ID, 99, None).len(), MAX_COVERS);
    }
}
