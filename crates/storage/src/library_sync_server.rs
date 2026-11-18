//! The account's sealed library on the Community server (`library_sync`), readable and
//! deletable by its owner only; saves go through `save_library_sync`, which refuses a save
//! made from an out-of-date copy.

use std::time::Duration;

use devatlas_application::library_sync::{RemoteCopy, RemoteHead, SyncServer};
use reqwest::header::CONTENT_TYPE;
use serde::Deserialize;

use crate::community::{SupabaseCommunity, SupabaseError, error_code, refusal};

/// The server's limit on a sealed copy, plus room for the rest of the answer.
const MAX_COPY_BYTES: usize = 13 * 1024 * 1024;
/// A large library takes longer than other Community requests on a slow connection.
const TRANSFER_TIMEOUT: Duration = Duration::from_secs(120);
/// The server's answer to a save made from an out-of-date copy.
const CHANGED_MEANWHILE: &str = "40001";

#[derive(Deserialize)]
struct RawHead {
    generation: String,
    revision: i64,
}

impl From<RawHead> for RemoteHead {
    fn from(raw: RawHead) -> Self {
        Self {
            generation: raw.generation,
            revision: raw.revision,
        }
    }
}

#[derive(Deserialize)]
struct RawCopy {
    generation: String,
    revision: i64,
    salt: String,
    data: String,
}

impl SupabaseCommunity {
    /// `revision` 0 stores the first copy, of `generation`; otherwise the copy must still be
    /// at that generation and revision.
    async fn save_copy(
        &self,
        generation: &str,
        revision: i64,
        salt: Option<&str>,
        sealed: &str,
    ) -> Result<Option<RemoteHead>, SupabaseError> {
        let url = self.rest("rpc/save_library_sync")?;
        let body = serde_json::json!({
            "copy_generation": generation,
            "expected_revision": revision,
            "new_salt": salt,
            "new_data": sealed,
        })
        .to_string();
        let sent = self
            .authed(|http| {
                http.post(url.clone())
                    .timeout(TRANSFER_TIMEOUT)
                    .header(CONTENT_TYPE, "application/json")
                    .body(body.clone())
            })
            .await?;
        match sent {
            Ok(body) => Ok(Some(serde_json::from_slice::<RawHead>(&body)?.into())),
            Err((_, body)) if error_code(&body).as_deref() == Some(CHANGED_MEANWHILE) => Ok(None),
            Err((status, body)) => Err(refusal(status, &body)),
        }
    }
}

impl SyncServer for SupabaseCommunity {
    type Error = SupabaseError;

    async fn head(&self, owner: &str) -> Result<Option<RemoteHead>, SupabaseError> {
        let mut url = self.rest("library_sync")?;
        url.query_pairs_mut()
            .append_pair("select", "generation,revision")
            .append_pair("owner_id", &format!("eq.{owner}"));
        let raw: Vec<RawHead> = serde_json::from_slice(&self.get(url).await?)?;
        Ok(raw.into_iter().next().map(RemoteHead::from))
    }

    async fn fetch(&self, owner: &str) -> Result<Option<RemoteCopy>, SupabaseError> {
        let mut url = self.rest("library_sync")?;
        url.query_pairs_mut()
            .append_pair("select", "generation,revision,salt,data")
            .append_pair("owner_id", &format!("eq.{owner}"));
        let body = self
            .authed_up_to(MAX_COPY_BYTES, |http| {
                http.get(url.clone()).timeout(TRANSFER_TIMEOUT)
            })
            .await?
            .map_err(|(status, body)| refusal(status, &body))?;
        let raw: Vec<RawCopy> = serde_json::from_slice(&body)?;
        Ok(raw.into_iter().next().map(|raw| RemoteCopy {
            head: RemoteHead {
                generation: raw.generation,
                revision: raw.revision,
            },
            salt: raw.salt,
            sealed: raw.data,
        }))
    }

    async fn create(
        &self,
        generation: &str,
        salt: &str,
        sealed: &str,
    ) -> Result<Option<RemoteHead>, SupabaseError> {
        self.save_copy(generation, 0, Some(salt), sealed).await
    }

    async fn update(
        &self,
        head: &RemoteHead,
        sealed: &str,
    ) -> Result<Option<RemoteHead>, SupabaseError> {
        self.save_copy(&head.generation, head.revision, None, sealed)
            .await
    }

    async fn delete(&self, owner: &str) -> Result<(), SupabaseError> {
        let mut url = self.rest("library_sync")?;
        url.query_pairs_mut()
            .append_pair("owner_id", &format!("eq.{owner}"));
        self.authed(|http| http.delete(url.clone()))
            .await?
            .map(drop)
            .map_err(|(status, body)| refusal(status, &body))
    }
}
