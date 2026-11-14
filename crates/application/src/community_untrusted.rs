//! Checks for what the community server sends and what is about to be published: ids,
//! https addresses and bounded, visible text.

use devatlas_domain::resource::Resource;
use url::Url;

use super::{
    CommunityInputError, MAX_DESCRIPTION_CHARS, MAX_LINK_TITLE_CHARS, MAX_LINKS, MAX_TIMESTAMP_LEN,
    MAX_TITLE_CHARS, MAX_URL_LEN, MAX_USERNAME_CHARS, Owner, SharedLink, SharedSummary,
};
use crate::agent::clean_text;

/// A server-made id: a UUID in its usual text form.
pub fn is_uuid(id: &str) -> bool {
    id.len() == 36
        && id.char_indices().all(|(index, c)| match index {
            8 | 13 | 18 | 23 => c == '-',
            _ => c.is_ascii_hexdigit(),
        })
}

pub(super) fn check_id(id: &str) -> Result<&str, CommunityInputError> {
    is_uuid(id)
        .then_some(id)
        .ok_or(CommunityInputError::InvalidId)
}

/// An https address no longer than the server allows, or `None`.
pub fn https_url(raw: &str) -> Option<Url> {
    let url = Url::parse(raw.trim()).ok()?;
    let fits =
        url.scheme() == "https" && url.host_str().is_some() && url.as_str().len() <= MAX_URL_LEN;
    fits.then_some(url)
}

pub(super) fn host_of(url: &Url) -> String {
    url.host_str()
        .unwrap_or_default()
        .trim_start_matches("www.")
        .to_owned()
}

/// Cleaned text, or `None` when nothing is left.
pub(super) fn optional_text(text: Option<&str>, max: usize) -> Option<String> {
    let cleaned = clean_text(text?, max);
    (!cleaned.is_empty()).then_some(cleaned)
}

/// A link from the server, or `None` when it isn't https or the library couldn't hold it.
pub fn untrusted_link(url: &str, title: &str) -> Option<SharedLink> {
    let url = https_url(url)?;
    let host = host_of(&url);
    let library_id = Resource::saved(title, url.as_str(), 0)?.id;
    let title = optional_text(Some(title), MAX_LINK_TITLE_CHARS).unwrap_or_else(|| host.clone());
    Some(SharedLink {
        url: url.into(),
        title,
        host,
        library_id,
    })
}

/// Raw fields of a collection from the server.
pub struct UntrustedSummary<'a> {
    pub id: &'a str,
    pub title: &'a str,
    pub description: Option<&'a str>,
    pub link_count: i64,
    pub updated_at: &'a str,
    pub owner_id: &'a str,
    pub username: &'a str,
    pub avatar_url: Option<&'a str>,
    pub follower_count: i64,
}

/// A follower count from the server: a non-negative integer, or `None`.
pub fn follower_count(raw: i64) -> Option<u32> {
    u32::try_from(raw).ok()
}

/// A collection from the server, or `None` when its id, timestamp or follower count is
/// malformed.
pub fn untrusted_summary(raw: &UntrustedSummary<'_>) -> Option<SharedSummary> {
    let timestamp_ok = !raw.updated_at.is_empty()
        && raw.updated_at.len() <= MAX_TIMESTAMP_LEN
        && raw
            .updated_at
            .chars()
            .all(|c| c.is_ascii_digit() || matches!(c, '-' | ':' | '.' | '+' | 'T' | 'Z' | ' '));
    if !is_uuid(raw.id) || !is_uuid(raw.owner_id) || !timestamp_ok {
        return None;
    }
    Some(SharedSummary {
        id: raw.id.to_ascii_lowercase(),
        title: optional_text(Some(raw.title), MAX_TITLE_CHARS)?,
        description: optional_text(raw.description, MAX_DESCRIPTION_CHARS),
        link_count: u32::try_from(raw.link_count.clamp(0, MAX_LINKS as i64)).unwrap_or(0),
        updated_at: raw.updated_at.to_owned(),
        owner: Owner {
            id: raw.owner_id.to_ascii_lowercase(),
            username: optional_text(Some(raw.username), MAX_USERNAME_CHARS)
                .unwrap_or_else(|| "unknown".to_owned()),
            avatar_url: raw.avatar_url.and_then(avatar_url),
        },
        follower_count: follower_count(raw.follower_count)?,
    })
}

/// GitHub's avatar host only. Account metadata is editable by its owner, so any other address
/// could track everyone who views their collections.
pub fn avatar_url(raw: &str) -> Option<String> {
    https_url(raw)
        .filter(|url| url.host_str() == Some("avatars.githubusercontent.com"))
        .map(String::from)
}
