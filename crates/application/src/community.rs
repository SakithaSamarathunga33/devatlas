//! Community: collections DevAtlas users publish for others to browse and copy links from.
//!
//! Everything a community server returns is someone else's text, so it is cleaned here before
//! it reaches the UI: only https links, bounded lengths, no control characters. Publishing
//! sends a collection's name and description plus each link's address and title, never the
//! user's notes, tags or reading status.

use std::collections::HashMap;
use std::future::Future;

use serde::Serialize;

use crate::agent::{clean_text, without_secrets};
use crate::library::LibraryItem;
use crate::organizer::Group;

#[path = "community_untrusted.rs"]
mod untrusted;
pub use untrusted::{
    UntrustedSummary, avatar_url, follower_count, https_url, is_uuid, untrusted_link,
    untrusted_summary,
};
use untrusted::{check_id, host_of, optional_text};

/// Collections per page when browsing.
pub const PAGE_SIZE: u32 = 30;
/// The server's limits, checked here first so publishing fails with a clear message.
pub const MAX_LINKS: usize = 200;
pub const MAX_TITLE_CHARS: usize = 80;
pub const MAX_DESCRIPTION_CHARS: usize = 500;
pub const MAX_LINK_TITLE_CHARS: usize = 300;
pub const MAX_URL_LEN: usize = 2_048;
pub const MAX_REASON_CHARS: usize = 500;
const MAX_USERNAME_CHARS: usize = 39;
const MAX_QUERY_CHARS: usize = 100;
/// Paging deeper than this is no longer browsing.
const MAX_OFFSET: u32 = 10_000;
const MAX_TIMESTAMP_LEN: usize = 40;

/// The signed-in account, as GitHub names it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommunityUser {
    pub id: String,
    pub username: String,
    pub avatar_url: Option<String>,
}

/// Who published a collection.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Owner {
    pub id: String,
    pub username: String,
    pub avatar_url: Option<String>,
}

/// A published collection as a list shows it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SharedSummary {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub link_count: u32,
    /// An ISO 8601 timestamp.
    pub updated_at: String,
    pub owner: Owner,
    /// How many accounts follow it; the server keeps this exact.
    pub follower_count: u32,
}

/// One link of a published collection.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SharedLink {
    pub url: String,
    pub title: String,
    pub host: String,
    /// The id the link would have in the library, to show whether it is saved already.
    pub library_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SharedCollection {
    #[serde(flatten)]
    pub summary: SharedSummary,
    pub links: Vec<SharedLink>,
    /// Whether the signed-in account follows it; `None` when signed out or unknown.
    pub is_following: Option<bool>,
}

/// A collection's follow state after following or unfollowing it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FollowState {
    pub following: bool,
    pub follower_count: u32,
}

/// A page of collections; `next_offset` is `None` on the last page.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SharedPage {
    pub collections: Vec<SharedSummary>,
    pub next_offset: Option<u32>,
}

/// What a browse asks the server for.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CollectionFilter {
    /// Search words, already trimmed and bounded.
    pub query: Option<String>,
    /// Only this account's collections.
    pub owner_id: Option<String>,
    pub offset: u32,
}

/// Exactly what publishing sends: the body of the server's `publish_collection` call.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PublishRequest {
    /// `None` creates a collection, an id replaces that one.
    pub collection: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub links: Vec<PublishLink>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PublishLink {
    pub url: String,
    pub title: String,
}

/// How a publish went.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PublishOutcome {
    Published(String),
    /// The collection to replace isn't the caller's, or no longer exists.
    NotYours,
}

/// What sharing a local collection would make public, shown before publishing.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SharePreview {
    pub title: String,
    pub description: Option<String>,
    pub links: Vec<PreviewLink>,
    /// Links left out because they aren't https.
    pub skipped: usize,
    /// The published copy, when this collection was shared before.
    pub shared_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewLink {
    pub url: String,
    pub title: String,
    pub host: String,
}

/// Port: the community server.
pub trait CommunitySource {
    type Error: std::error::Error;

    fn collections(
        &self,
        filter: &CollectionFilter,
    ) -> impl Future<Output = Result<SharedPage, Self::Error>> + Send;
    fn collection(
        &self,
        id: &str,
    ) -> impl Future<Output = Result<Option<SharedCollection>, Self::Error>> + Send;
    fn publish(
        &self,
        request: &PublishRequest,
    ) -> impl Future<Output = Result<PublishOutcome, Self::Error>> + Send;
    fn unpublish(&self, id: &str) -> impl Future<Output = Result<(), Self::Error>> + Send;
    /// Returns `false` when this account had already reported the collection.
    fn report(
        &self,
        id: &str,
        reason: Option<&str>,
    ) -> impl Future<Output = Result<bool, Self::Error>> + Send;
    /// Follows as the signed-in account; following twice is fine. Returns `false` when the
    /// server refuses: the collection is the caller's own.
    fn follow(&self, id: &str) -> impl Future<Output = Result<bool, Self::Error>> + Send;
    /// Unfollows as the signed-in account; not following is fine.
    fn unfollow(&self, id: &str) -> impl Future<Output = Result<(), Self::Error>> + Send;
    /// Whether the signed-in account follows the collection; `None` when signed out or unknown.
    fn is_following(
        &self,
        id: &str,
    ) -> impl Future<Output = Result<Option<bool>, Self::Error>> + Send;
    /// The collection's follower count; `None` when it can't be found.
    fn follower_count(
        &self,
        id: &str,
    ) -> impl Future<Output = Result<Option<u32>, Self::Error>> + Send;
}

/// Port: the community account. Tokens stay inside the implementation.
pub trait CommunityAuth {
    type Error: std::error::Error;

    /// The signed-in account, restoring a stored session if needed; `None` when signed out.
    fn current_user(
        &self,
    ) -> impl Future<Output = Result<Option<CommunityUser>, Self::Error>> + Send;
    /// Signs in through the system browser.
    fn sign_in(&self) -> impl Future<Output = Result<CommunityUser, Self::Error>> + Send;
    /// Stops a sign-in that is waiting for the browser.
    fn cancel_sign_in(&self);
    fn sign_out(&self) -> impl Future<Output = Result<(), Self::Error>> + Send;
    /// Erases the signed-in account on the server with everything it published, followed and
    /// reported, then forgets the session here as signing out does.
    fn delete_account(&self) -> impl Future<Output = Result<(), Self::Error>> + Send;
}

/// Port: which published collection belongs to which local collection, so sharing again
/// updates instead of duplicating. Keys are local group ids, values shared ids.
pub trait ShareStore {
    type Error: std::error::Error;

    fn load(&self) -> Result<HashMap<String, String>, Self::Error>;
    fn save(&self, shares: &HashMap<String, String>) -> Result<(), Self::Error>;
}

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum CommunityInputError {
    #[error("That collection link isn't valid.")]
    InvalidId,
    #[error("This collection has no https links to share.")]
    NoLinks,
    #[error("A shared collection holds at most {MAX_LINKS} links; this one has {0}.")]
    TooManyLinks(usize),
    #[error("Give the collection a name before sharing it.")]
    TitleRequired,
    #[error("Reasons can be at most {MAX_REASON_CHARS} characters long.")]
    ReasonTooLong,
    #[error("That collection isn't in DevAtlas any more.")]
    GroupNotFound,
    #[error("That shared collection no longer exists.")]
    NotFound,
    #[error("Sign in with GitHub first.")]
    NotSignedIn,
    #[error("You can't follow your own collection.")]
    OwnCollection,
}

#[derive(Debug, thiserror::Error)]
pub enum CommunityError<S: std::error::Error, M: std::error::Error> {
    #[error(transparent)]
    Invalid(#[from] CommunityInputError),
    #[error(transparent)]
    Source(S),
    #[error("DevAtlas couldn't remember which collection was shared: {0}")]
    Store(M),
}

/// The collections matching `query` (all of them when blank), newest first.
pub async fn browse<S: CommunitySource>(
    source: &S,
    query: Option<&str>,
    offset: u32,
) -> Result<SharedPage, S::Error> {
    let query = query
        .map(|text| clean_text(text, MAX_QUERY_CHARS))
        .filter(|text| !text.is_empty());
    let filter = CollectionFilter {
        query,
        owner_id: None,
        offset,
    };
    if offset > MAX_OFFSET {
        return Ok(SharedPage {
            collections: Vec::new(),
            next_offset: None,
        });
    }
    source.collections(&filter).await
}

/// An account's own collections, every page of them (an account has at most 50).
pub async fn my_collections<S: CommunitySource>(
    source: &S,
    owner_id: &str,
) -> Result<Vec<SharedSummary>, CommunityError<S::Error, std::convert::Infallible>> {
    let mut filter = CollectionFilter {
        query: None,
        owner_id: Some(check_id(owner_id)?.to_owned()),
        offset: 0,
    };
    let mut collections = Vec::new();
    loop {
        let page = source
            .collections(&filter)
            .await
            .map_err(CommunityError::Source)?;
        collections.extend(page.collections);
        match page.next_offset {
            Some(next) if next > filter.offset && next <= MAX_OFFSET => filter.offset = next,
            _ => return Ok(collections),
        }
    }
}

pub async fn collection<S: CommunitySource>(
    source: &S,
    id: &str,
) -> Result<SharedCollection, CommunityError<S::Error, std::convert::Infallible>> {
    let id = check_id(id)?;
    let collection = source
        .collection(id)
        .await
        .map_err(CommunityError::Source)?
        .ok_or(CommunityInputError::NotFound)?;
    let is_following = source
        .is_following(id)
        .await
        .map_err(CommunityError::Source)?;
    Ok(SharedCollection {
        is_following,
        ..collection
    })
}

/// Follows (`following`) or unfollows a collection, then reads back its follower count.
pub async fn set_following<S: CommunitySource>(
    source: &S,
    id: &str,
    following: bool,
) -> Result<FollowState, CommunityError<S::Error, std::convert::Infallible>> {
    let id = check_id(id)?.to_ascii_lowercase();
    if following {
        let allowed = source.follow(&id).await.map_err(CommunityError::Source)?;
        if !allowed {
            return Err(CommunityInputError::OwnCollection.into());
        }
    } else {
        source.unfollow(&id).await.map_err(CommunityError::Source)?;
    }
    let follower_count = source
        .follower_count(&id)
        .await
        .map_err(CommunityError::Source)?
        .ok_or(CommunityInputError::NotFound)?;
    Ok(FollowState {
        following,
        follower_count,
    })
}

/// What sharing `group` would publish: its name, description and https links, in the order
/// the collection page lists them.
pub fn share_preview(
    group: &Group,
    library: &[LibraryItem],
    shared_id: Option<String>,
) -> SharePreview {
    let members = library
        .iter()
        .map(|item| &item.resource)
        .filter(|resource| group.resource_ids.contains(&resource.id));
    let mut links = Vec::new();
    let mut skipped = 0;
    for resource in members {
        match https_url(&resource.url) {
            Some(url) => {
                // Scheme, host and path go public, as the preview lists them; queries,
                // fragments and credentials can hold tokens (signed links, share keys).
                let url = without_secrets(&url);
                let host = host_of(&url);
                let title = optional_text(Some(&resource.title), MAX_LINK_TITLE_CHARS)
                    .unwrap_or_else(|| host.clone());
                links.push(PreviewLink {
                    url: url.into(),
                    title,
                    host,
                });
            }
            None => skipped += 1,
        }
    }
    SharePreview {
        title: clean_text(&group.name, MAX_TITLE_CHARS),
        description: optional_text(group.description.as_deref(), MAX_DESCRIPTION_CHARS),
        links,
        skipped,
        shared_id,
    }
}

/// The local collection's published copy, if it has one.
pub fn shared_id<M: ShareStore>(shares: &M, group_id: &str) -> Result<Option<String>, M::Error> {
    Ok(shares
        .load()?
        .get(group_id)
        .filter(|id| is_uuid(id))
        .cloned())
}

fn publish_request(
    preview: &SharePreview,
    collection: Option<String>,
) -> Result<PublishRequest, CommunityInputError> {
    if preview.title.is_empty() {
        return Err(CommunityInputError::TitleRequired);
    }
    match preview.links.len() {
        0 => return Err(CommunityInputError::NoLinks),
        count if count > MAX_LINKS => return Err(CommunityInputError::TooManyLinks(count)),
        _ => {}
    }
    Ok(PublishRequest {
        collection,
        title: preview.title.clone(),
        description: preview.description.clone(),
        links: preview
            .links
            .iter()
            .map(|link| PublishLink {
                url: link.url.clone(),
                title: link.title.clone(),
            })
            .collect(),
    })
}

/// Publishes `group`, replacing its earlier published copy when there is one, and remembers
/// which published collection it is. Returns the published id.
pub async fn share_group<S, M>(
    source: &S,
    shares: &M,
    group: &Group,
    library: &[LibraryItem],
) -> Result<String, CommunityError<S::Error, M::Error>>
where
    S: CommunitySource,
    M: ShareStore,
{
    let previous = shared_id(shares, &group.id).map_err(CommunityError::Store)?;
    let preview = share_preview(group, library, previous.clone());
    let request = publish_request(&preview, previous)?;
    let mut outcome = source
        .publish(&request)
        .await
        .map_err(CommunityError::Source)?;
    if outcome == PublishOutcome::NotYours && request.collection.is_some() {
        // Unshared elsewhere, or shared by another account on this computer: publish anew.
        let fresh = PublishRequest {
            collection: None,
            ..request
        };
        outcome = source
            .publish(&fresh)
            .await
            .map_err(CommunityError::Source)?;
    }
    let PublishOutcome::Published(id) = outcome else {
        return Err(CommunityInputError::NotFound.into());
    };
    let id = check_id(&id)?.to_ascii_lowercase();
    let mut map = shares.load().map_err(CommunityError::Store)?;
    map.insert(group.id.clone(), id.clone());
    shares.save(&map).map_err(CommunityError::Store)?;
    Ok(id)
}

/// Takes a published collection down and forgets which local collection it came from.
pub async fn unshare<S, M>(
    source: &S,
    shares: &M,
    id: &str,
) -> Result<(), CommunityError<S::Error, M::Error>>
where
    S: CommunitySource,
    M: ShareStore,
{
    let id = check_id(id)?.to_ascii_lowercase();
    source
        .unpublish(&id)
        .await
        .map_err(CommunityError::Source)?;
    let map = shares.load().map_err(CommunityError::Store)?;
    let kept: HashMap<String, String> = map
        .iter()
        .filter(|(_, shared)| **shared != id)
        .map(|(group, shared)| (group.clone(), shared.clone()))
        .collect();
    if kept.len() != map.len() {
        shares.save(&kept).map_err(CommunityError::Store)?;
    }
    Ok(())
}

/// Deletes the Community account, then forgets which local collections were shared: their
/// published copies are gone with it. The local library is untouched.
pub async fn delete_account<A, M>(
    auth: &A,
    shares: &M,
) -> Result<(), CommunityError<A::Error, M::Error>>
where
    A: CommunityAuth,
    M: ShareStore,
{
    auth.delete_account()
        .await
        .map_err(CommunityError::Source)?;
    shares.save(&HashMap::new()).map_err(CommunityError::Store)
}

/// Reports a collection to the moderators. Returns `false` when already reported.
pub async fn report<S: CommunitySource>(
    source: &S,
    id: &str,
    reason: Option<&str>,
) -> Result<bool, CommunityError<S::Error, std::convert::Infallible>> {
    let id = check_id(id)?;
    let reason = reason.map(str::trim).filter(|text| !text.is_empty());
    if reason.is_some_and(|text| text.chars().count() > MAX_REASON_CHARS) {
        return Err(CommunityInputError::ReasonTooLong.into());
    }
    let reason = reason.map(|text| clean_text(text, MAX_REASON_CHARS));
    source
        .report(id, reason.as_deref())
        .await
        .map_err(CommunityError::Source)
}

#[cfg(test)]
#[path = "community_tests.rs"]
mod tests;
