//! The Community server (Supabase): published collections read through PostgREST, and
//! publishing, unpublishing and reporting as the signed-in account.
//!
//! Every request carries the public API key and the signed-in account's access token: the
//! server lets only signed-in accounts read Community, so signed out nothing is sent.
//! Requests follow no redirects and every answer is bounded in time and size, then cleaned by
//! the application layer before it reaches the UI.

use std::time::Duration;

use devatlas_application::agent::clean_text;
use devatlas_application::community::{
    self, CollectionFilter, CommunitySource, PAGE_SIZE, PublishOutcome, PublishRequest,
    SharedCollection, SharedLink, SharedPage, SharedSummary, UntrustedSummary,
};
use reqwest::header::CONTENT_TYPE;
use reqwest::{RequestBuilder, Response, StatusCode};
use serde::Deserialize;
use url::Url;

use crate::community_auth::SupabaseAuth;
use crate::credentials::CredentialError;

const REQUEST_TIMEOUT: Duration = Duration::from_secs(15);
const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const MAX_RESPONSE_BYTES: usize = 1024 * 1024;
const MAX_KEY_LEN: usize = 512;
const MAX_MESSAGE_CHARS: usize = 200;
const USER_AGENT: &str = concat!("DevAtlas/", env!("CARGO_PKG_VERSION"));
// `!owner_id`: follows give a second path to profiles, which PostgREST refuses as ambiguous (300).
const SUMMARY_FIELDS: &str = "id,owner_id,title,description,link_count,follower_count,updated_at,owner:profiles!owner_id(username,avatar_url)";

#[derive(Debug, thiserror::Error)]
pub enum SupabaseError {
    #[error("Sign in with GitHub first.")]
    NotSignedIn,
    #[error("Sign in to see Community.")]
    SignInToRead,
    #[error("Your sign-in has expired. Sign out, then sign in again.")]
    SessionExpired,
    #[error("Sign-in was cancelled.")]
    Cancelled,
    #[error("Sign-in timed out. Try again.")]
    TimedOut,
    #[error("GitHub sign-in didn't finish: {0}")]
    Provider(String),
    #[error("DevAtlas couldn't open your browser: {0}")]
    Browser(String),
    #[error("Sign-in was refused: {0}")]
    AuthRejected(String),
    #[error("The Community server refused that: {0}")]
    Rejected(String),
    #[error("The Community server answered with status {0}.")]
    Status(u16),
    #[error("The Community server couldn't be reached: {0}")]
    Http(#[from] reqwest::Error),
    #[error("The Community server sent an unexpected response: {0}")]
    Format(#[from] serde_json::Error),
    #[error("The Community server's response was larger than expected.")]
    TooLarge,
    #[error(transparent)]
    Url(#[from] url::ParseError),
    #[error("The sign-in listener failed: {0}")]
    Listener(#[from] std::io::Error),
    #[error("Your sign-in couldn't be stored: {0}")]
    Credentials(#[from] CredentialError),
    #[error("DevAtlas couldn't create a sign-in code: {0}")]
    Random(#[from] getrandom::Error),
    #[error("DevAtlas has no valid Community key.")]
    InvalidKey,
}

/// Where the Community server is and the public key every request carries.
#[derive(Clone)]
pub struct CommunityConfig {
    pub(crate) base: Url,
    pub(crate) api_key: String,
}

impl CommunityConfig {
    /// `api_key` is public by design, but still only header-safe text is accepted.
    pub fn new(base: &str, api_key: &str) -> Result<Self, SupabaseError> {
        let api_key = api_key.trim();
        let safe = |c: char| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.');
        if api_key.is_empty() || api_key.len() > MAX_KEY_LEN || !api_key.chars().all(safe) {
            return Err(SupabaseError::InvalidKey);
        }
        let base = Url::parse(base)?;
        if base.scheme() != "https" {
            return Err(SupabaseError::InvalidKey);
        }
        Ok(Self {
            base,
            api_key: api_key.to_owned(),
        })
    }

    pub(crate) fn endpoint(&self, path: &str) -> Result<Url, url::ParseError> {
        self.base.join(path)
    }
}

pub(crate) fn http_client() -> Result<reqwest::Client, reqwest::Error> {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(REQUEST_TIMEOUT)
        .connect_timeout(CONNECT_TIMEOUT)
        .redirect(reqwest::redirect::Policy::none())
        .build()
}

/// The body, at most `MAX_RESPONSE_BYTES` long.
pub(crate) async fn read_body(mut response: Response) -> Result<Vec<u8>, SupabaseError> {
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await? {
        body.extend_from_slice(&chunk);
        if body.len() > MAX_RESPONSE_BYTES {
            return Err(SupabaseError::TooLarge);
        }
    }
    Ok(body)
}

/// The server's own explanation of a refusal, cleaned; it is shown as plain text.
pub(crate) fn server_message(body: &[u8]) -> Option<String> {
    #[derive(Deserialize)]
    struct ErrorBody {
        message: Option<String>,
        msg: Option<String>,
        error_description: Option<String>,
    }
    let parsed: ErrorBody = serde_json::from_slice(body).ok()?;
    let text = parsed.message.or(parsed.msg).or(parsed.error_description)?;
    let cleaned = clean_text(&text, MAX_MESSAGE_CHARS);
    (!cleaned.is_empty()).then_some(cleaned)
}

/// PostgREST's error code, such as `42501` for "not allowed".
fn error_code(body: &[u8]) -> Option<String> {
    #[derive(Deserialize)]
    struct ErrorBody {
        code: Option<String>,
    }
    serde_json::from_slice::<ErrorBody>(body).ok()?.code
}

#[derive(Deserialize)]
struct RawOwner {
    username: String,
    avatar_url: Option<String>,
}

#[derive(Deserialize)]
struct RawLink {
    position: i64,
    url: String,
    title: String,
}

#[derive(Deserialize)]
struct RawCollection {
    id: String,
    owner_id: String,
    title: String,
    description: Option<String>,
    link_count: i64,
    follower_count: i64,
    updated_at: String,
    owner: Option<RawOwner>,
    #[serde(default)]
    links: Vec<RawLink>,
}

fn summary(raw: &RawCollection) -> Option<SharedSummary> {
    let owner = raw.owner.as_ref()?;
    community::untrusted_summary(&UntrustedSummary {
        id: &raw.id,
        title: &raw.title,
        description: raw.description.as_deref(),
        link_count: raw.link_count,
        updated_at: &raw.updated_at,
        owner_id: &raw.owner_id,
        username: &owner.username,
        avatar_url: owner.avatar_url.as_deref(),
        follower_count: raw.follower_count,
    })
}

/// A page of collections; malformed ones are left out, but still count towards paging.
fn parse_page(body: &[u8], offset: u32) -> Result<SharedPage, serde_json::Error> {
    let raw: Vec<RawCollection> = serde_json::from_slice(body)?;
    let full = raw.len() >= PAGE_SIZE as usize;
    Ok(SharedPage {
        collections: raw.iter().filter_map(summary).collect(),
        next_offset: full.then(|| offset.saturating_add(PAGE_SIZE)),
    })
}

/// One collection with its links in order, dropping links that aren't https.
fn parse_collection(body: &[u8]) -> Result<Option<SharedCollection>, serde_json::Error> {
    let raw: Vec<RawCollection> = serde_json::from_slice(body)?;
    let Some(mut first) = raw.into_iter().next() else {
        return Ok(None);
    };
    let Some(summary) = summary(&first) else {
        return Ok(None);
    };
    first.links.sort_by_key(|link| link.position);
    let links: Vec<SharedLink> = first
        .links
        .iter()
        .take(community::MAX_LINKS)
        .filter_map(|link| community::untrusted_link(&link.url, &link.title))
        .collect();
    Ok(Some(SharedCollection {
        summary,
        links,
        is_following: None,
    }))
}

/// What following sends: only the collection; the server fills in the account.
fn follow_body(id: &str) -> String {
    serde_json::json!({ "collection_id": id }).to_string()
}

/// Whether a follow went through; `false` when the server refused it as the caller's own.
fn follow_outcome(sent: Answer) -> Result<bool, SupabaseError> {
    match sent {
        Ok(_) => Ok(true),
        // Already following: the (collection, account) key's unique violation.
        Err((StatusCode::CONFLICT, body)) if error_code(&body).as_deref() == Some("23505") => {
            Ok(true)
        }
        // Row level security lets an account follow only other accounts' collections.
        Err((StatusCode::FORBIDDEN, body)) if error_code(&body).as_deref() == Some("42501") => {
            Ok(false)
        }
        Err((status, body)) => Err(refusal(status, &body)),
    }
}

/// The caller's follow rows for one collection: any row means following.
fn parse_following(body: &[u8]) -> Result<bool, serde_json::Error> {
    let rows: Vec<serde::de::IgnoredAny> = serde_json::from_slice(body)?;
    Ok(!rows.is_empty())
}

/// A collection's follower count; `None` when no collection came back.
fn parse_follower_count(body: &[u8]) -> Result<Option<u32>, serde_json::Error> {
    #[derive(Deserialize)]
    struct RawCount {
        follower_count: i64,
    }
    let rows: Vec<RawCount> = serde_json::from_slice(body)?;
    rows.first()
        .map(|row| {
            community::follower_count(row.follower_count).ok_or_else(|| {
                <serde_json::Error as serde::de::Error>::custom("invalid follower count")
            })
        })
        .transpose()
}

/// The Community server, with the account it acts as.
pub struct SupabaseCommunity {
    http: reqwest::Client,
    config: CommunityConfig,
    auth: SupabaseAuth,
}

impl SupabaseCommunity {
    pub fn new(config: CommunityConfig, auth: SupabaseAuth) -> Result<Self, SupabaseError> {
        Ok(Self {
            http: http_client()?,
            config,
            auth,
        })
    }

    pub fn auth(&self) -> &SupabaseAuth {
        &self.auth
    }

    fn public(&self, request: RequestBuilder) -> RequestBuilder {
        request.header("apikey", &self.config.api_key)
    }

    /// GETs a PostgREST URL as the signed-in account.
    async fn get(&self, url: Url) -> Result<Vec<u8>, SupabaseError> {
        read_outcome(self.authed(|http| http.get(url.clone())).await)
    }

    /// Sends a signed-in request; `Err((status, body))` for a refusal.
    async fn authed(
        &self,
        build: impl Fn(&reqwest::Client) -> RequestBuilder,
    ) -> Result<Answer, SupabaseError> {
        let response = self
            .auth
            .send(|token| self.public(build(&self.http)).bearer_auth(token))
            .await?;
        let status = response.status();
        let body = read_body(response).await?;
        Ok(if status.is_success() {
            Ok(body)
        } else {
            Err((status, body))
        })
    }

    fn rest(&self, table: &str) -> Result<Url, url::ParseError> {
        self.config.endpoint(&format!("rest/v1/{table}"))
    }
}

/// A signed-in request's body, or the status and body of the server's refusal.
type Answer = Result<Vec<u8>, (StatusCode, Vec<u8>)>;

/// A read's body; signed out, a clear request to sign in rather than an anonymous call.
fn read_outcome(sent: Result<Answer, SupabaseError>) -> Result<Vec<u8>, SupabaseError> {
    match sent {
        Ok(Ok(body)) => Ok(body),
        Ok(Err((status, body))) => Err(refusal(status, &body)),
        Err(SupabaseError::NotSignedIn) => Err(SupabaseError::SignInToRead),
        Err(error) => Err(error),
    }
}

pub(crate) fn refusal(status: StatusCode, body: &[u8]) -> SupabaseError {
    match server_message(body) {
        Some(message) if status.is_client_error() => SupabaseError::Rejected(message),
        _ => SupabaseError::Status(status.as_u16()),
    }
}

impl CommunitySource for SupabaseCommunity {
    type Error = SupabaseError;

    async fn collections(&self, filter: &CollectionFilter) -> Result<SharedPage, SupabaseError> {
        let mut url = self.rest("shared_collections")?;
        {
            let mut query = url.query_pairs_mut();
            query
                .append_pair("select", SUMMARY_FIELDS)
                // `id` breaks ties, so paging never repeats or skips a collection.
                .append_pair("order", "updated_at.desc,id.desc")
                .append_pair("limit", &PAGE_SIZE.to_string())
                .append_pair("offset", &filter.offset.to_string());
            match &filter.owner_id {
                Some(owner) => query.append_pair("owner_id", &format!("eq.{owner}")),
                None => query.append_pair("is_hidden", "is.false"),
            };
            if let Some(terms) = &filter.query {
                query.append_pair("search", &format!("wfts(simple).{terms}"));
            }
        }
        // An owner also sees the collections a moderator hid.
        Ok(parse_page(&self.get(url).await?, filter.offset)?)
    }

    async fn collection(&self, id: &str) -> Result<Option<SharedCollection>, SupabaseError> {
        let mut url = self.rest("shared_collections")?;
        url.query_pairs_mut()
            .append_pair(
                "select",
                &format!("{SUMMARY_FIELDS},links:shared_links(position,url,title)"),
            )
            .append_pair("id", &format!("eq.{id}"));
        Ok(parse_collection(&self.get(url).await?)?)
    }

    async fn publish(&self, request: &PublishRequest) -> Result<PublishOutcome, SupabaseError> {
        let url = self.rest("rpc/publish_collection")?;
        let body = serde_json::to_vec(request)?;
        let sent = self
            .authed(|http| {
                http.post(url.clone())
                    .header(CONTENT_TYPE, "application/json")
                    .body(body.clone())
            })
            .await?;
        match sent {
            Ok(body) => Ok(PublishOutcome::Published(serde_json::from_slice(&body)?)),
            Err((status, body))
                if request.collection.is_some()
                    && error_code(&body).as_deref() == Some("42501") =>
            {
                tracing::debug!(%status, "the shared collection to replace is not ours");
                Ok(PublishOutcome::NotYours)
            }
            Err((status, body)) => Err(refusal(status, &body)),
        }
    }

    async fn unpublish(&self, id: &str) -> Result<(), SupabaseError> {
        let mut url = self.rest("shared_collections")?;
        url.query_pairs_mut().append_pair("id", &format!("eq.{id}"));
        match self
            .authed(|http| http.delete(url.clone()).header("Prefer", "return=minimal"))
            .await?
        {
            Ok(_) => Ok(()),
            Err((status, body)) => Err(refusal(status, &body)),
        }
    }

    async fn report(&self, id: &str, reason: Option<&str>) -> Result<bool, SupabaseError> {
        let url = self.rest("reports")?;
        let body = serde_json::json!({ "collection_id": id, "reason": reason });
        let sent = self
            .authed(|http| {
                http.post(url.clone())
                    .header(CONTENT_TYPE, "application/json")
                    .header("Prefer", "return=minimal")
                    .body(body.to_string())
            })
            .await?;
        match sent {
            Ok(_) => Ok(true),
            // One report per account and collection: a unique violation.
            Err((StatusCode::CONFLICT, body)) if error_code(&body).as_deref() == Some("23505") => {
                Ok(false)
            }
            Err((status, body)) => Err(refusal(status, &body)),
        }
    }

    async fn follow(&self, id: &str) -> Result<bool, SupabaseError> {
        let url = self.rest("collection_follows")?;
        let body = follow_body(id);
        let sent = self
            .authed(|http| {
                http.post(url.clone())
                    .header(CONTENT_TYPE, "application/json")
                    .header("Prefer", "return=minimal")
                    .body(body.clone())
            })
            .await?;
        follow_outcome(sent)
    }

    async fn unfollow(&self, id: &str) -> Result<(), SupabaseError> {
        let mut url = self.rest("collection_follows")?;
        // Row level security limits the delete to the caller's own row.
        url.query_pairs_mut()
            .append_pair("collection_id", &format!("eq.{id}"));
        match self
            .authed(|http| http.delete(url.clone()).header("Prefer", "return=minimal"))
            .await?
        {
            Ok(_) => Ok(()),
            Err((status, body)) => Err(refusal(status, &body)),
        }
    }

    async fn is_following(&self, id: &str) -> Result<Option<bool>, SupabaseError> {
        let mut url = self.rest("collection_follows")?;
        url.query_pairs_mut()
            .append_pair("select", "collection_id")
            .append_pair("collection_id", &format!("eq.{id}"));
        let following = match self.authed(|http| http.get(url.clone())).await {
            Ok(Ok(body)) => parse_following(&body).map_err(SupabaseError::from),
            Ok(Err((status, body))) => Err(refusal(status, &body)),
            Err(error) => Err(error),
        };
        // Unknown rather than a failed page: following then reports what is wrong, such as an
        // expired sign-in.
        Ok(following
            .inspect_err(|error| match error {
                SupabaseError::NotSignedIn => {}
                _ => tracing::warn!(%error, "couldn't read whether this account follows the collection"),
            })
            .ok())
    }

    async fn follower_count(&self, id: &str) -> Result<Option<u32>, SupabaseError> {
        let mut url = self.rest("shared_collections")?;
        url.query_pairs_mut()
            .append_pair("select", "follower_count")
            .append_pair("id", &format!("eq.{id}"));
        Ok(parse_follower_count(&self.get(url).await?)?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const ID: &str = "0b8f4a9e-6d2c-4b1a-9f3e-2c7d5e8a1b40";
    const OWNER: &str = "11111111-2222-4333-8444-555555555555";

    fn row(links: &str) -> String {
        format!(
            r#"{{"id":"{ID}","owner_id":"{OWNER}","title":"Rust","description":null,
            "link_count":3,"follower_count":12,"updated_at":"2026-11-14T10:00:00+00:00",
            "owner":{{"username":"octocat","avatar_url":"https://avatars.githubusercontent.com/u/1"}},
            "links":[{links}]}}"#
        )
    }

    #[test]
    fn parses_a_collection_dropping_unsafe_links_in_position_order() {
        let body = row(r#"{"position":2,"url":"https://b.dev/","title":"B"},
               {"position":0,"url":"javascript:alert(1)","title":"bad"},
               {"position":1,"url":"https://a.dev/","title":"A"}"#);
        let collection = parse_collection(format!("[{body}]").as_bytes())
            .unwrap()
            .unwrap();
        let titles: Vec<_> = collection
            .links
            .iter()
            .map(|link| link.title.as_str())
            .collect();
        assert_eq!(titles, ["A", "B"]);
        assert_eq!(collection.summary.owner.username, "octocat");
        assert_eq!(collection.summary.follower_count, 12);
        assert_eq!(collection.is_following, None);
        assert_eq!(parse_collection(b"[]").unwrap(), None);
    }

    #[test]
    fn a_row_with_a_negative_follower_count_is_left_out() {
        let bad = row("").replace(r#""follower_count":12"#, r#""follower_count":-1"#);
        assert!(
            parse_page(format!("[{bad}]").as_bytes(), 0)
                .unwrap()
                .collections
                .is_empty()
        );
    }

    #[test]
    fn following_sends_only_the_collection_id() {
        let body: serde_json::Value = serde_json::from_str(&follow_body(ID)).unwrap();
        assert_eq!(body, serde_json::json!({ "collection_id": ID }));
    }

    #[test]
    fn a_duplicate_follow_counts_as_following() {
        let duplicate = br#"{"code":"23505","message":"duplicate key value"}"#.to_vec();
        assert!(follow_outcome(Ok(Vec::new())).unwrap());
        assert!(follow_outcome(Err((StatusCode::CONFLICT, duplicate))).unwrap());
    }

    #[test]
    fn following_your_own_collection_is_refused_not_failed() {
        let denied = br#"{"code":"42501","message":"new row violates row-level security policy"}"#;
        assert!(!follow_outcome(Err((StatusCode::FORBIDDEN, denied.to_vec()))).unwrap());
        assert!(follow_outcome(Err((StatusCode::UNAUTHORIZED, denied.to_vec()))).is_err());

        let other = br#"{"code":"22P02","message":"invalid input syntax for type uuid"}"#;
        assert!(matches!(
            follow_outcome(Err((StatusCode::BAD_REQUEST, other.to_vec()))),
            Err(SupabaseError::Rejected(_))
        ));
        assert!(matches!(
            follow_outcome(Err((StatusCode::CONFLICT, b"{}".to_vec()))),
            Err(SupabaseError::Status(409))
        ));
    }

    #[test]
    fn reads_following_and_follower_counts() {
        assert!(parse_following(format!(r#"[{{"collection_id":"{ID}"}}]"#).as_bytes()).unwrap());
        assert!(!parse_following(b"[]").unwrap());
        assert_eq!(
            parse_follower_count(br#"[{"follower_count":13}]"#).unwrap(),
            Some(13)
        );
        assert_eq!(parse_follower_count(b"[]").unwrap(), None);
        assert!(parse_follower_count(br#"[{"follower_count":-2}]"#).is_err());
        assert!(parse_follower_count(br#"[{"follower_count":1.5}]"#).is_err());
    }

    #[test]
    fn a_page_skips_malformed_rows_but_pages_on_the_raw_count() {
        let good = row("");
        let bad = good.replace(ID, "not-a-uuid");
        let rows: Vec<&str> = std::iter::once(bad.as_str())
            .chain(std::iter::repeat_n(good.as_str(), PAGE_SIZE as usize - 1))
            .collect();
        let page = parse_page(format!("[{}]", rows.join(",")).as_bytes(), 30).unwrap();
        assert_eq!(page.collections.len(), PAGE_SIZE as usize - 1);
        assert_eq!(page.next_offset, Some(60));

        let short = parse_page(format!("[{good}]").as_bytes(), 0).unwrap();
        assert_eq!(short.next_offset, None);
    }

    #[test]
    fn reads_server_messages_as_bounded_plain_text() {
        let body = format!(r#"{{"code":"54000","message":"{}"}}"#, "x".repeat(500));
        let message = server_message(body.as_bytes()).unwrap();
        assert_eq!(message.chars().count(), MAX_MESSAGE_CHARS);
        assert_eq!(error_code(body.as_bytes()).as_deref(), Some("54000"));
        assert_eq!(server_message(b"<html>"), None);
    }

    #[test]
    fn reads_signed_out_ask_to_sign_in_instead_of_going_anonymous() {
        assert!(matches!(
            read_outcome(Err(SupabaseError::NotSignedIn)),
            Err(SupabaseError::SignInToRead)
        ));
        assert_eq!(
            SupabaseError::SignInToRead.to_string(),
            "Sign in to see Community."
        );
        assert_eq!(read_outcome(Ok(Ok(b"[]".to_vec()))).unwrap(), b"[]");
        let denied = br#"{"code":"42501","message":"permission denied for table profiles"}"#;
        assert!(matches!(
            read_outcome(Ok(Err((StatusCode::FORBIDDEN, denied.to_vec())))),
            Err(SupabaseError::Rejected(_))
        ));
        assert!(matches!(
            read_outcome(Err(SupabaseError::SessionExpired)),
            Err(SupabaseError::SessionExpired)
        ));
    }

    #[test]
    fn accepts_only_header_safe_keys_and_https_servers() {
        assert!(CommunityConfig::new("https://x.supabase.co", " sb_publishable_Ab-1.c \n").is_ok());
        assert!(CommunityConfig::new("https://x.supabase.co", "a\r\nX-Evil: 1").is_err());
        assert!(CommunityConfig::new("https://x.supabase.co", "").is_err());
        assert!(CommunityConfig::new("http://x.supabase.co", "key").is_err());
    }
}
