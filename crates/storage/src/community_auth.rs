//! The Community account: GitHub sign-in through Supabase Auth with PKCE and a loopback
//! redirect, and the session it yields.
//!
//! The access token lives in memory only; the refresh token is kept in the OS credential
//! store so the next launch stays signed in. Refresh tokens rotate, so each new one replaces
//! the stored one. Neither token is ever logged or handed to the webview.

use std::net::Ipv4Addr;
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::time::{Duration, Instant};

use devatlas_application::agent::clean_text;
use devatlas_application::community::{self, CommunityAuth, CommunityUser};
use devatlas_application::settings::SecretStore;
use devatlas_application::stars::clean_username;
use reqwest::header::CONTENT_TYPE;
use reqwest::{RequestBuilder, Response, StatusCode};
use serde::Deserialize;
use tokio::net::TcpListener;
use tokio::sync::Notify;

use crate::community::{CommunityConfig, SupabaseError, http_client, read_body, server_message};
use crate::community_loopback::{CALLBACK_PATH, Pkce, wait_for_code};
use crate::credentials::KeyringSecret;

/// How long the browser has to come back.
const SIGN_IN_TIMEOUT: Duration = Duration::from_secs(5 * 60);
/// Refresh this long before the access token expires.
const REFRESH_MARGIN: Duration = Duration::from_secs(60);
const MAX_EXPIRES_IN: u64 = 7 * 24 * 60 * 60;
const MAX_TOKEN_LEN: usize = 16 * 1024;
const MAX_USERNAME_CHARS: usize = 39;

/// Opens a URL in the system browser.
pub type BrowserOpener = Box<dyn Fn(&str) -> Result<(), String> + Send + Sync>;

/// A signed-in session. Deliberately not `Debug`: it holds tokens.
struct Session {
    access_token: String,
    refresh_token: String,
    expires_at: Instant,
    user: CommunityUser,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: String,
    expires_in: u64,
    user: RawUser,
}

#[derive(Deserialize)]
struct RawUser {
    id: String,
    #[serde(default)]
    user_metadata: RawMetadata,
}

#[derive(Deserialize, Default)]
struct RawMetadata {
    user_name: Option<String>,
    preferred_username: Option<String>,
    avatar_url: Option<String>,
}

/// Visible ASCII only, so a token can never add an HTTP header.
fn is_token(token: &str) -> bool {
    !token.is_empty() && token.len() <= MAX_TOKEN_LEN && token.bytes().all(|b| b.is_ascii_graphic())
}

fn parse_session(body: &[u8], now: Instant) -> Result<Session, SupabaseError> {
    let raw: TokenResponse = serde_json::from_slice(body)?;
    let malformed =
        || SupabaseError::AuthRejected("the server sent a malformed session.".to_owned());
    if !is_token(&raw.access_token)
        || !is_token(&raw.refresh_token)
        || !community::is_uuid(&raw.user.id)
    {
        return Err(malformed());
    }
    let metadata = raw.user.user_metadata;
    let login = metadata
        .user_name
        .or(metadata.preferred_username)
        .unwrap_or_default();
    let username = clean_username(&login)
        .unwrap_or_else(|| clean_text(&login, MAX_USERNAME_CHARS))
        .chars()
        .take(MAX_USERNAME_CHARS)
        .collect::<String>();
    Ok(Session {
        access_token: raw.access_token,
        refresh_token: raw.refresh_token,
        expires_at: now + Duration::from_secs(raw.expires_in.min(MAX_EXPIRES_IN)),
        user: CommunityUser {
            id: raw.user.id.to_ascii_lowercase(),
            username: if username.is_empty() {
                "GitHub user".to_owned()
            } else {
                username
            },
            avatar_url: metadata
                .avatar_url
                .as_deref()
                .and_then(community::avatar_url),
        },
    })
}

pub struct SupabaseAuth {
    http: reqwest::Client,
    config: CommunityConfig,
    /// The refresh token.
    secret: KeyringSecret,
    open_browser: BrowserOpener,
    session: Mutex<Option<Session>>,
    /// One refresh at a time: refresh tokens are single use.
    refresh_lock: tokio::sync::Mutex<()>,
    /// Cancels the sign-in waiting for the browser, if any.
    pending: Mutex<Option<Arc<Notify>>>,
}

impl SupabaseAuth {
    pub fn new(
        config: CommunityConfig,
        secret: KeyringSecret,
        open_browser: BrowserOpener,
    ) -> Result<Self, SupabaseError> {
        Ok(Self {
            http: http_client()?,
            config,
            secret,
            open_browser,
            session: Mutex::default(),
            refresh_lock: tokio::sync::Mutex::default(),
            pending: Mutex::default(),
        })
    }

    /// A poisoned lock only means another request panicked; the session is still valid.
    fn lock(&self) -> MutexGuard<'_, Option<Session>> {
        self.session.lock().unwrap_or_else(PoisonError::into_inner)
    }

    fn pending(&self) -> MutexGuard<'_, Option<Arc<Notify>>> {
        self.pending.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// The access token and account, unless the token is about to expire.
    fn fresh(&self) -> Option<(String, CommunityUser)> {
        self.lock()
            .as_ref()
            .filter(|session| session.expires_at > Instant::now() + REFRESH_MARGIN)
            .map(|session| (session.access_token.clone(), session.user.clone()))
    }

    /// Makes the next request refresh, if `access_token` is still the current one.
    fn expire(&self, access_token: &str) {
        if let Some(session) = self.lock().as_mut()
            && session.access_token == access_token
        {
            session.expires_at = Instant::now();
        }
    }

    /// Stores the rotated refresh token and keeps the session in memory.
    fn keep(&self, session: Session) -> (String, CommunityUser) {
        if let Err(error) = self.secret.save(&session.refresh_token) {
            tracing::warn!(%error, "could not store the Community session; sign-in lasts until DevAtlas closes");
        }
        let current = (session.access_token.clone(), session.user.clone());
        *self.lock() = Some(session);
        current
    }

    async fn token_request(
        &self,
        grant: &str,
        body: serde_json::Value,
    ) -> Result<Session, SupabaseError> {
        let mut url = self.config.endpoint("auth/v1/token")?;
        url.query_pairs_mut().append_pair("grant_type", grant);
        let response = self
            .http
            .post(url)
            .header("apikey", &self.config.api_key)
            .header(CONTENT_TYPE, "application/json")
            .body(body.to_string())
            .send()
            .await?;
        let status = response.status();
        let body = read_body(response).await?;
        // Only these mean the grant itself was refused; a rate limit (429) is worth retrying.
        let refused = [400, 401, 403, 422].contains(&status.as_u16());
        if refused {
            let reason = server_message(&body).unwrap_or_else(|| format!("status {status}"));
            return Err(SupabaseError::AuthRejected(reason));
        }
        if !status.is_success() {
            return Err(SupabaseError::Status(status.as_u16()));
        }
        parse_session(&body, Instant::now())
    }

    /// The current session, refreshed when it is close to expiring or not loaded yet.
    async fn session(&self) -> Result<Option<(String, CommunityUser)>, SupabaseError> {
        if let Some(current) = self.fresh() {
            return Ok(Some(current));
        }
        let _guard = self.refresh_lock.lock().await;
        if let Some(current) = self.fresh() {
            return Ok(Some(current));
        }
        let in_memory = self
            .lock()
            .as_ref()
            .map(|session| session.refresh_token.clone());
        let refresh_token = match in_memory {
            Some(token) => token,
            None => match self.secret.load()? {
                Some(token) => token,
                None => return Ok(None),
            },
        };
        let body = serde_json::json!({ "refresh_token": refresh_token });
        match self.token_request("refresh_token", body).await {
            Ok(session) => Ok(Some(self.keep(session))),
            Err(SupabaseError::AuthRejected(_)) => {
                tracing::info!("the stored Community session is no longer valid; signed out");
                *self.lock() = None;
                self.secret.delete()?;
                Ok(None)
            }
            Err(error) => Err(error),
        }
    }

    /// Sends a request as the signed-in account, refreshing once if the token was refused.
    pub(crate) async fn send(
        &self,
        build: impl Fn(&str) -> RequestBuilder,
    ) -> Result<Response, SupabaseError> {
        let (token, _) = self.session().await?.ok_or(SupabaseError::NotSignedIn)?;
        let response = build(&token).send().await?;
        if response.status() != StatusCode::UNAUTHORIZED {
            return Ok(response);
        }
        self.expire(&token);
        let (token, _) = self.session().await?.ok_or(SupabaseError::NotSignedIn)?;
        let response = build(&token).send().await?;
        if response.status() == StatusCode::UNAUTHORIZED {
            return Err(SupabaseError::SessionExpired);
        }
        Ok(response)
    }

    /// Whether `cancel` still belongs to the newest sign-in that wasn't cancelled.
    fn is_current(&self, cancel: &Arc<Notify>) -> bool {
        self.pending()
            .as_ref()
            .is_some_and(|current| Arc::ptr_eq(current, cancel))
    }

    async fn browser_sign_in(&self, cancel: &Arc<Notify>) -> Result<CommunityUser, SupabaseError> {
        let pkce = Pkce::generate()?;
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
        let port = listener.local_addr()?.port();
        let redirect = format!("http://127.0.0.1:{port}{CALLBACK_PATH}");
        let mut authorize = self.config.endpoint("auth/v1/authorize")?;
        authorize
            .query_pairs_mut()
            .append_pair("provider", "github")
            .append_pair("redirect_to", &redirect)
            .append_pair("code_challenge", &pkce.challenge)
            .append_pair("code_challenge_method", "s256");
        (self.open_browser)(authorize.as_str()).map_err(SupabaseError::Browser)?;

        let code = tokio::select! {
            reply = wait_for_code(&listener) => reply?.map_err(SupabaseError::Provider)?,
            () = cancel.notified() => return Err(SupabaseError::Cancelled),
            () = tokio::time::sleep(SIGN_IN_TIMEOUT) => return Err(SupabaseError::TimedOut),
        };
        drop(listener);

        let body = serde_json::json!({ "auth_code": code, "code_verifier": pkce.verifier });
        let session = self.token_request("pkce", body).await?;
        let _guard = self.refresh_lock.lock().await;
        // Cancelled, or replaced by a newer attempt, while the code was being exchanged.
        if !self.is_current(cancel) {
            return Err(SupabaseError::Cancelled);
        }
        let (_, user) = self.keep(session);
        tracing::info!("signed in to Community");
        Ok(user)
    }
}

impl CommunityAuth for SupabaseAuth {
    type Error = SupabaseError;

    async fn current_user(&self) -> Result<Option<CommunityUser>, SupabaseError> {
        Ok(self.session().await?.map(|(_, user)| user))
    }

    /// A new sign-in cancels one still waiting for the browser.
    async fn sign_in(&self) -> Result<CommunityUser, SupabaseError> {
        let cancel = Arc::new(Notify::new());
        if let Some(previous) = self.pending().replace(Arc::clone(&cancel)) {
            previous.notify_one();
        }
        let result = self.browser_sign_in(&cancel).await;
        if self.is_current(&cancel) {
            *self.pending() = None;
        }
        result
    }

    fn cancel_sign_in(&self) {
        if let Some(pending) = self.pending().take() {
            pending.notify_one();
        }
    }

    /// Ends the session on the server (best effort) and forgets it here.
    async fn sign_out(&self) -> Result<(), SupabaseError> {
        let _guard = self.refresh_lock.lock().await;
        let session = self.lock().take();
        if let Some(session) = session {
            let url = self.config.endpoint("auth/v1/logout")?;
            let sent = self
                .http
                .post(url)
                .header("apikey", &self.config.api_key)
                .bearer_auth(&session.access_token)
                .send()
                .await;
            match sent {
                Ok(response) if response.status().is_success() => {}
                Ok(response) => {
                    tracing::debug!(status = %response.status(), "the server did not end the session");
                }
                Err(error) => tracing::debug!(%error, "could not reach the server to sign out"),
            }
        }
        self.secret.delete()?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn body(access: &str, id: &str, avatar: &str) -> String {
        format!(
            r#"{{"access_token":"{access}","token_type":"bearer","expires_in":3600,
            "refresh_token":"r3fr35h","user":{{"id":"{id}",
            "user_metadata":{{"user_name":"octocat","avatar_url":"{avatar}"}}}}}}"#
        )
    }

    const ID: &str = "0B8F4A9E-6D2C-4B1A-9F3E-2C7D5E8A1B40";

    #[test]
    fn parses_a_session() {
        let now = Instant::now();
        let session = parse_session(
            body("eyJ.a.b", ID, "https://avatars.githubusercontent.com/u/1").as_bytes(),
            now,
        )
        .unwrap();
        assert_eq!(session.user.id, ID.to_ascii_lowercase());
        assert_eq!(session.user.username, "octocat");
        assert_eq!(
            session.user.avatar_url.as_deref(),
            Some("https://avatars.githubusercontent.com/u/1")
        );
        assert_eq!(session.refresh_token, "r3fr35h");
        assert_eq!(session.expires_at, now + Duration::from_secs(3600));
    }

    #[test]
    fn drops_avatars_not_hosted_by_github() {
        let session = parse_session(
            body("t", ID, "https://tracker.example/pixel.gif").as_bytes(),
            Instant::now(),
        )
        .unwrap();
        assert_eq!(session.user.avatar_url, None);
    }

    #[test]
    fn refuses_tokens_that_could_inject_headers_and_bad_ids() {
        assert!(parse_session(body("a\\r\\nX: 1", ID, "").as_bytes(), Instant::now()).is_err());
        assert!(parse_session(body("a b", ID, "").as_bytes(), Instant::now()).is_err());
        assert!(parse_session(body("t", "not-an-id", "").as_bytes(), Instant::now()).is_err());
        assert!(parse_session(b"{}", Instant::now()).is_err());
    }
}
