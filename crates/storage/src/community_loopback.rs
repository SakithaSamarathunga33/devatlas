//! The browser half of Community sign-in: a PKCE code pair (RFC 7636) and a one-shot listener
//! on 127.0.0.1 that receives the sign-in reply (RFC 8252, loopback redirect).

use std::time::Duration;

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use devatlas_application::agent::clean_text;
use sha2::{Digest, Sha256};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::task::JoinSet;
use url::Url;

pub(crate) const CALLBACK_PATH: &str = "/auth/callback";
/// A request line longer than this isn't a sign-in reply.
const MAX_REQUEST_BYTES: usize = 8 * 1024;
const MAX_CODE_LEN: usize = 512;
const MAX_ERROR_CHARS: usize = 300;
/// How long one connection may take, from its request line to the reply.
const CONNECTION_TIMEOUT: Duration = Duration::from_secs(5);
/// Connections served at once; more are dropped until one finishes.
const MAX_CONNECTIONS: usize = 16;
const VERIFIER_BYTES: usize = 32;

/// A PKCE pair: the verifier stays here, the challenge goes to the browser.
pub(crate) struct Pkce {
    pub verifier: String,
    pub challenge: String,
}

impl Pkce {
    /// A verifier of 32 bytes from the operating system's random source.
    pub fn generate() -> Result<Self, getrandom::Error> {
        let mut bytes = [0_u8; VERIFIER_BYTES];
        getrandom::fill(&mut bytes)?;
        let verifier = URL_SAFE_NO_PAD.encode(bytes);
        Ok(Self {
            challenge: challenge_for(&verifier),
            verifier,
        })
    }
}

/// `S256`: base64url, unpadded, of the verifier's SHA-256.
pub(crate) fn challenge_for(verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}

/// What one request to the listener carried.
#[derive(Debug, PartialEq, Eq)]
pub(crate) enum Callback {
    Code(String),
    /// The sign-in failed, with the reason to show.
    Error(String),
    /// Anything else, such as the browser asking for a favicon.
    Other,
}

fn is_code(code: &str) -> bool {
    !code.is_empty()
        && code.len() <= MAX_CODE_LEN
        && code
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | '~'))
}

/// Reads `GET /auth/callback?code=…` (or `?error=…`) from the start of a request.
pub(crate) fn parse_request(head: &[u8]) -> Callback {
    let Some(end) = head.windows(2).position(|pair| pair == b"\r\n") else {
        return Callback::Other;
    };
    let Ok(line) = std::str::from_utf8(&head[..end]) else {
        return Callback::Other;
    };
    let mut parts = line.split(' ');
    let (Some("GET"), Some(target), Some(version), None) =
        (parts.next(), parts.next(), parts.next(), parts.next())
    else {
        return Callback::Other;
    };
    if !target.starts_with('/') || !version.starts_with("HTTP/") {
        return Callback::Other;
    }
    let Ok(url) = Url::parse(&format!("http://127.0.0.1{target}")) else {
        return Callback::Other;
    };
    if url.path() != CALLBACK_PATH {
        return Callback::Other;
    }
    let value = |key: &str| {
        url.query_pairs()
            .find(|(name, _)| name == key)
            .map(|(_, value)| value.into_owned())
    };
    if let Some(error) = value("error") {
        let reason = value("error_description").unwrap_or(error);
        let reason = clean_text(&reason, MAX_ERROR_CHARS);
        return Callback::Error(if reason.is_empty() {
            "the sign-in was refused.".to_owned()
        } else {
            reason
        });
    }
    match value("code") {
        Some(code) if is_code(&code) => Callback::Code(code),
        Some(_) => Callback::Error("the sign-in reply was malformed.".to_owned()),
        None => Callback::Other,
    }
}

/// The page's only script; the response's CSP allows exactly this text by its hash.
const CLOSE_SCRIPT: &str = "window.close()";
const CLOSE_SCRIPT_HASH: &str = "sha256-jqxtvDkBbRAl9Hpqv68WdNOieepg8tJSYu1xIy7zT34=";

/// A small page in DevAtlas's colours that follows the system light or dark setting.
fn page(heading: &str, detail: &str, closes: bool) -> String {
    let script = if closes {
        format!("<script>{CLOSE_SCRIPT}</script>")
    } else {
        String::new()
    };
    format!(
        "<!doctype html><html lang=\"en\"><meta charset=\"utf-8\">\
         <meta name=\"color-scheme\" content=\"dark light\"><title>DevAtlas</title>\
         <style>\
         body{{margin:0;min-height:100vh;display:grid;place-items:center;\
         font:15px/1.5 \"Segoe UI\",system-ui,sans-serif;background:#0b0b14;color:#e8e8f0}}\
         main{{text-align:center;padding:32px 40px;border-radius:20px;\
         background:rgba(99,102,241,.08);border:1px solid rgba(255,255,255,.1)}}\
         h1{{margin:0 0 6px;font-size:20px;font-weight:600}}p{{margin:0;color:#a3a3b8}}\
         @media (prefers-color-scheme:light){{body{{background:#f5f5fb;color:#16162a}}\
         main{{background:rgba(99,102,241,.06);border-color:rgba(0,0,0,.08)}}p{{color:#55556a}}}}\
         </style><main><h1>{heading}</h1><p>{detail}</p></main>{script}</html>"
    )
}

/// Static pages only: nothing from the request is echoed back.
fn response(callback: &Callback) -> String {
    let (status, body) = match callback {
        Callback::Code(_) => (
            "200 OK",
            page(
                "You're signed in",
                "DevAtlas is open again. You can close this tab.",
                true,
            ),
        ),
        Callback::Error(_) => (
            "200 OK",
            page(
                "Sign-in didn't finish",
                "Return to DevAtlas for details.",
                false,
            ),
        ),
        Callback::Other => ("404 Not Found", String::new()),
    };
    format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\n\
         Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; \
         script-src '{CLOSE_SCRIPT_HASH}'\r\nCache-Control: no-store\r\n\
         Content-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    )
}

/// Reads up to the end of the request line, never more than `MAX_REQUEST_BYTES`.
async fn read_head(stream: &mut TcpStream) -> std::io::Result<Vec<u8>> {
    let mut head = Vec::new();
    let mut buffer = [0_u8; 1024];
    while head.len() < MAX_REQUEST_BYTES && !head.windows(2).any(|pair| pair == b"\r\n") {
        let read = stream.read(&mut buffer).await?;
        if read == 0 {
            break;
        }
        head.extend_from_slice(&buffer[..read]);
    }
    head.truncate(MAX_REQUEST_BYTES);
    Ok(head)
}

async fn handle(mut stream: TcpStream) -> Callback {
    let callback = match read_head(&mut stream).await {
        Ok(head) => parse_request(&head),
        Err(_) => return Callback::Other,
    };
    // The browser may already have closed the tab; the reply itself is all that matters.
    if let Err(error) = stream.write_all(response(&callback).as_bytes()).await {
        tracing::debug!(%error, "could not answer the sign-in request");
    }
    let _ = stream.shutdown().await;
    callback
}

/// Accepts connections until one carries the sign-in reply. `Ok(Err(reason))` when the
/// sign-in itself failed.
///
/// Connections are served side by side, each within `CONNECTION_TIMEOUT`: browsers open idle
/// speculative connections, and the reply must not wait behind them.
pub(crate) async fn wait_for_code(
    listener: &TcpListener,
) -> std::io::Result<Result<String, String>> {
    let mut connections = JoinSet::new();
    loop {
        tokio::select! {
            accepted = listener.accept() => {
                let (stream, _) = accepted?;
                if connections.len() < MAX_CONNECTIONS {
                    connections.spawn(tokio::time::timeout(CONNECTION_TIMEOUT, handle(stream)));
                }
            }
            Some(served) = connections.join_next() => match served {
                Ok(Ok(Callback::Code(code))) => return Ok(Ok(code)),
                Ok(Ok(Callback::Error(reason))) => return Ok(Err(reason)),
                _ => {}
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// RFC 7636 appendix B.
    #[test]
    fn matches_the_rfc_7636_example() {
        assert_eq!(
            challenge_for("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }

    #[test]
    fn generates_distinct_url_safe_verifiers() {
        let first = Pkce::generate().unwrap();
        let second = Pkce::generate().unwrap();
        assert_eq!(first.verifier.len(), 43);
        assert_ne!(first.verifier, second.verifier);
        assert!(is_code(&first.verifier));
        assert_eq!(first.challenge, challenge_for(&first.verifier));
    }

    #[test]
    fn reads_the_code() {
        let request =
            b"GET /auth/callback?code=4b1a-9f3e_x.y~z HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n";
        assert_eq!(
            parse_request(request),
            Callback::Code("4b1a-9f3e_x.y~z".to_owned())
        );
    }

    #[test]
    fn reads_the_error_and_cleans_it() {
        let request = b"GET /auth/callback?error=access_denied&error_description=Unsupported+provider%3A%0Anot%20enabled HTTP/1.1\r\n";
        assert_eq!(
            parse_request(request),
            Callback::Error("Unsupported provider: not enabled".to_owned())
        );
        let bare = b"GET /auth/callback?error=server_error HTTP/1.1\r\n";
        assert_eq!(
            parse_request(bare),
            Callback::Error("server_error".to_owned())
        );
    }

    #[test]
    fn refuses_malformed_codes() {
        let request = b"GET /auth/callback?code=%3Cscript%3E HTTP/1.1\r\n";
        assert!(matches!(parse_request(request), Callback::Error(_)));
        let long = format!("GET /auth/callback?code={} HTTP/1.1\r\n", "a".repeat(600));
        assert!(matches!(parse_request(long.as_bytes()), Callback::Error(_)));
    }

    #[test]
    fn ignores_everything_else() {
        for request in [
            &b"GET /favicon.ico HTTP/1.1\r\n"[..],
            b"POST /auth/callback?code=abc HTTP/1.1\r\n",
            b"GET /auth/callback?code=abc HTTP/1.1",
            b"GET /auth/callback HTTP/1.1\r\n",
            b"GET //evil.example/auth/callback?code=abc HTTP/1.1\r\n",
            b"GET /auth/callback?code=abc HTTP/1.1 extra\r\n",
            b"\xff\xfe\r\n",
            b"",
        ] {
            assert_eq!(parse_request(request), Callback::Other, "{request:?}");
        }
    }

    #[test]
    fn an_oversized_request_line_is_not_a_reply() {
        let mut request = b"GET /auth/callback?code=".to_vec();
        request.extend(std::iter::repeat_n(b'a', MAX_REQUEST_BYTES));
        request.truncate(MAX_REQUEST_BYTES);
        assert_eq!(parse_request(&request), Callback::Other);
    }

    #[test]
    fn answers_with_a_static_page() {
        let page = response(&Callback::Error("<b>x</b>".to_owned()));
        assert!(page.starts_with("HTTP/1.1 200 OK\r\n"));
        assert!(!page.contains("<b>"));
        let signed_in = response(&Callback::Code("c".to_owned()));
        assert!(signed_in.contains("You can close this tab."));
        assert!(signed_in.contains("<script>window.close()</script>"));
        assert!(
            !page.contains("<script>"),
            "an error page stays open to be read"
        );
    }

    #[test]
    fn the_csp_hash_matches_the_close_script() {
        use base64::Engine;
        use sha2::{Digest, Sha256};
        let hash = base64::engine::general_purpose::STANDARD.encode(Sha256::digest(CLOSE_SCRIPT));
        assert_eq!(CLOSE_SCRIPT_HASH, format!("sha256-{hash}"));
    }

    #[tokio::test]
    async fn waits_past_other_requests_for_the_reply() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let browser = tokio::spawn(async move {
            // An idle speculative connection must not hold up the reply.
            let _idle = TcpStream::connect(address).await.unwrap();
            for request in [
                "GET /favicon.ico HTTP/1.1\r\n\r\n",
                "GET /auth/callback?code=abc123 HTTP/1.1\r\n\r\n",
            ] {
                let mut stream = TcpStream::connect(address).await.unwrap();
                stream.write_all(request.as_bytes()).await.unwrap();
                let mut reply = String::new();
                stream.read_to_string(&mut reply).await.unwrap();
            }
        });

        let code = wait_for_code(&listener).await.unwrap();

        assert_eq!(code, Ok("abc123".to_owned()));
        browser.await.unwrap();
    }
}
