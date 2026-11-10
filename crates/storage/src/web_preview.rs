//! Fetches preview images (`og:image`, icons) from public web pages.
//!
//! Hardened against server-side request forgery: only http(s), every DNS answer and every
//! redirect target must be a public address, redirects are capped, and responses are bounded
//! in time and size. No cookies or credentials are sent.

use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;
use std::time::Duration;

use devatlas_application::preview::{PreviewSource, ResourcePreview};
use reqwest::dns::{Addrs, Name, Resolve, Resolving};
use reqwest::header::{ACCEPT, CONTENT_TYPE};
use reqwest::redirect;
use scraper::{Html, Selector};
use tokio::sync::Semaphore;
use url::{Host, Url};

const MAX_REDIRECTS: usize = 5;
const MAX_HTML_BYTES: usize = 1024 * 1024;
const MAX_CONCURRENT_FETCHES: usize = 6;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);
const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
/// Some sites refuse non-browser user agents; identify as a browser plus DevAtlas.
const USER_AGENT: &str = concat!(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ",
    "Chrome/130.0 Safari/537.36 DevAtlas/",
    env!("CARGO_PKG_VERSION")
);

#[derive(Debug, thiserror::Error)]
pub enum WebPreviewError {
    #[error("{0} is not a public web address")]
    NotPublic(String),
    #[error(transparent)]
    Http(#[from] reqwest::Error),
    #[error("the preview fetcher is shutting down")]
    Closed,
}

pub struct WebPreviewFetcher {
    client: reqwest::Client,
    permits: Semaphore,
}

impl WebPreviewFetcher {
    pub fn new() -> Result<Self, WebPreviewError> {
        let client = reqwest::Client::builder()
            .user_agent(USER_AGENT)
            .timeout(REQUEST_TIMEOUT)
            .connect_timeout(CONNECT_TIMEOUT)
            .no_proxy()
            .dns_resolver(Arc::new(PublicOnlyResolver))
            .redirect(redirect::Policy::custom(|attempt| {
                if attempt.previous().len() >= MAX_REDIRECTS {
                    attempt.error("too many redirects")
                } else if !is_public_url(attempt.url()) {
                    attempt.error("redirect to a non-public address")
                } else {
                    attempt.follow()
                }
            }))
            .build()?;
        Ok(Self {
            client,
            permits: Semaphore::new(MAX_CONCURRENT_FETCHES),
        })
    }
}

impl PreviewSource for WebPreviewFetcher {
    type Error = WebPreviewError;

    async fn fetch(&self, url: &Url) -> Result<ResourcePreview, WebPreviewError> {
        if !is_public_url(url) {
            return Err(WebPreviewError::NotPublic(url.to_string()));
        }
        let _permit = self
            .permits
            .acquire()
            .await
            .map_err(|_| WebPreviewError::Closed)?;

        let mut response = self
            .client
            .get(url.clone())
            .header(ACCEPT, "text/html,application/xhtml+xml")
            .send()
            .await?;
        let page_url = response.url().clone();
        let is_html = response
            .headers()
            .get(CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .is_some_and(|value| value.contains("html"));
        if !response.status().is_success() || !is_html {
            // Login walls and bot checks still usually serve the site's favicon.
            return Ok(ResourcePreview {
                title: None,
                image: None,
                icon: default_icon(&page_url),
            });
        }

        let mut body = Vec::new();
        while let Some(chunk) = response.chunk().await? {
            body.extend_from_slice(&chunk);
            if body.len() >= MAX_HTML_BYTES {
                body.truncate(MAX_HTML_BYTES);
                break;
            }
        }
        Ok(extract_preview(&String::from_utf8_lossy(&body), &page_url))
    }
}

/// Resolves host names, dropping every address that is not publicly routable.
struct PublicOnlyResolver;

impl Resolve for PublicOnlyResolver {
    fn resolve(&self, name: Name) -> Resolving {
        let host = name.as_str().to_owned();
        Box::pin(async move {
            let addresses: Vec<SocketAddr> = tokio::net::lookup_host((host.as_str(), 0))
                .await?
                .filter(|address| is_public_ip(address.ip()))
                .collect();
            if addresses.is_empty() {
                return Err(format!("{host} does not resolve to a public address").into());
            }
            Ok(Box::new(addresses.into_iter()) as Addrs)
        })
    }
}

/// http(s) only; literal IP hosts must be public (names are checked by the resolver).
fn is_public_url(url: &Url) -> bool {
    if !matches!(url.scheme(), "http" | "https") {
        return false;
    }
    match url.host() {
        Some(Host::Ipv4(ip)) => is_public_ip(IpAddr::V4(ip)),
        Some(Host::Ipv6(ip)) => is_public_ip(IpAddr::V6(ip)),
        Some(Host::Domain(domain)) => !domain.eq_ignore_ascii_case("localhost"),
        None => false,
    }
}

fn is_public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            let [a, b, ..] = v4.octets();
            let shared_cgnat = a == 100 && (64..=127).contains(&b);
            !(v4.is_private()
                || v4.is_loopback()
                || v4.is_link_local()
                || v4.is_broadcast()
                || v4.is_documentation()
                || v4.is_unspecified()
                || v4.is_multicast()
                || shared_cgnat
                || a == 0
                || a >= 240)
        }
        IpAddr::V6(v6) => {
            if let Some(v4) = v6.to_ipv4_mapped() {
                return is_public_ip(IpAddr::V4(v4));
            }
            let first = v6.segments()[0];
            let unique_local = (first & 0xfe00) == 0xfc00;
            let link_local = (first & 0xffc0) == 0xfe80;
            !(v6.is_loopback()
                || v6.is_unspecified()
                || v6.is_multicast()
                || unique_local
                || link_local)
        }
    }
}

const MAX_TITLE_CHARS: usize = 200;

/// Picks the page title, social preview image and best icon, resolved against the page URL.
fn extract_preview(html: &str, page_url: &Url) -> ResourcePreview {
    let document = Html::parse_document(html);
    let title = first_attribute(
        &document,
        &["meta[property='og:title']", "meta[name='twitter:title']"],
        "content",
    )
    .or_else(|| {
        let selector = Selector::parse("title").ok()?;
        let element = document.select(&selector).next()?;
        Some(element.text().collect::<String>())
    })
    .map(|raw| {
        raw.split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
            .chars()
            .take(MAX_TITLE_CHARS)
            .collect::<String>()
    })
    .filter(|title| !title.is_empty());
    let image = first_attribute(
        &document,
        &[
            "meta[property='og:image']",
            "meta[property='og:image:url']",
            "meta[name='twitter:image']",
            "meta[name='twitter:image:src']",
        ],
        "content",
    );
    let icon = first_attribute(
        &document,
        &["link[rel~='apple-touch-icon']", "link[rel~='icon']"],
        "href",
    );
    ResourcePreview {
        title,
        image: image.and_then(|value| resolve_web_url(page_url, &value)),
        icon: icon
            .and_then(|value| resolve_web_url(page_url, &value))
            .or_else(|| default_icon(page_url)),
    }
}

fn first_attribute(document: &Html, selectors: &[&str], attribute: &str) -> Option<String> {
    selectors
        .iter()
        .filter_map(|selector| Selector::parse(selector).ok())
        .find_map(|selector| {
            document
                .select(&selector)
                .find_map(|element| element.value().attr(attribute))
                .map(str::to_owned)
        })
}

fn resolve_web_url(base: &Url, value: &str) -> Option<String> {
    let url = base.join(value.trim()).ok()?;
    matches!(url.scheme(), "http" | "https").then(|| url.into())
}

fn default_icon(page_url: &Url) -> Option<String> {
    resolve_web_url(page_url, "/favicon.ico")
}

#[cfg(test)]
mod tests {
    use std::net::{Ipv4Addr, Ipv6Addr};

    use super::*;

    fn page() -> Url {
        Url::parse("https://reactbits.dev/get-started/index").unwrap()
    }

    #[test]
    fn extracts_og_image_and_apple_touch_icon_resolved_against_the_page() {
        let html = r#"<html><head>
            <meta property="og:image" content="/og/cover.png">
            <link rel="icon" href="/favicon-32.png">
            <link rel="apple-touch-icon" href="https://cdn.reactbits.dev/touch.png">
        </head></html>"#;

        let preview = extract_preview(html, &page());

        assert_eq!(
            preview.image.as_deref(),
            Some("https://reactbits.dev/og/cover.png")
        );
        assert_eq!(
            preview.icon.as_deref(),
            Some("https://cdn.reactbits.dev/touch.png")
        );
    }

    #[test]
    fn extracts_the_title_preferring_og_title_and_tidying_whitespace() {
        let og = r#"<title>Ignored</title><meta property="og:title" content="Best  Portfolio
            Websites">"#;
        let plain = "<html><head><title>\n  Awwwards — Portfolio  </title></head></html>";

        assert_eq!(
            extract_preview(og, &page()).title.as_deref(),
            Some("Best Portfolio Websites")
        );
        assert_eq!(
            extract_preview(plain, &page()).title.as_deref(),
            Some("Awwwards — Portfolio")
        );
        assert_eq!(extract_preview("<p>no head</p>", &page()).title, None);
    }

    #[test]
    fn falls_back_to_twitter_image_and_shortcut_icon() {
        let html = r#"<head>
            <meta name="twitter:image" content="https://img.example/card.jpg">
            <link rel="shortcut icon" href="icon.svg">
        </head>"#;

        let preview = extract_preview(html, &page());

        assert_eq!(
            preview.image.as_deref(),
            Some("https://img.example/card.jpg")
        );
        assert_eq!(
            preview.icon.as_deref(),
            Some("https://reactbits.dev/get-started/icon.svg")
        );
    }

    #[test]
    fn uses_favicon_ico_and_ignores_non_web_image_urls() {
        let html = r#"<meta property="og:image" content="javascript:alert(1)">"#;

        let preview = extract_preview(html, &page());

        assert_eq!(preview.image, None);
        assert_eq!(
            preview.icon.as_deref(),
            Some("https://reactbits.dev/favicon.ico")
        );
    }

    #[test]
    fn classifies_public_and_private_addresses() {
        let public: [IpAddr; 2] = [
            Ipv4Addr::new(104, 16, 0, 1).into(),
            "2606:4700::1".parse().unwrap(),
        ];
        for ip in public {
            assert!(is_public_ip(ip), "{ip} should be public");
        }

        let private: [IpAddr; 10] = [
            Ipv4Addr::LOCALHOST.into(),
            Ipv4Addr::new(10, 0, 0, 1).into(),
            Ipv4Addr::new(172, 16, 5, 4).into(),
            Ipv4Addr::new(192, 168, 1, 1).into(),
            Ipv4Addr::new(169, 254, 169, 254).into(),
            Ipv4Addr::new(100, 64, 0, 1).into(),
            Ipv4Addr::UNSPECIFIED.into(),
            Ipv6Addr::LOCALHOST.into(),
            "fd00::1".parse().unwrap(),
            "::ffff:127.0.0.1".parse().unwrap(),
        ];
        for ip in private {
            assert!(!is_public_ip(ip), "{ip} should be blocked");
        }
    }

    #[test]
    fn rejects_non_public_urls_before_connecting() {
        for raw in [
            "http://127.0.0.1/",
            "http://localhost:1420/",
            "http://[::1]/",
            "file:///C:/Windows/win.ini",
        ] {
            assert!(
                !is_public_url(&Url::parse(raw).unwrap()),
                "{raw} should be rejected"
            );
        }
        assert!(is_public_url(&page()));
    }
}
