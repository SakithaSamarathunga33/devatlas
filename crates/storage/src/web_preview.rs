//! Fetches preview images (`og:image`, icons) from public web pages.
//!
//! Hardened against server-side request forgery: only http(s), every DNS answer and every
//! redirect target must be a public address, redirects are capped, and responses are bounded
//! in time and size. No cookies or credentials are sent.

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr};
use std::sync::Arc;
use std::time::Duration;

use devatlas_application::link_health::{LinkChecker, LinkHealth};
use devatlas_application::preview::{PreviewSource, ResourcePreview};
use futures_util::future::join_all;
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
    /// Separate from `permits`, so a link check never starves preview images.
    check_permits: Semaphore,
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
            check_permits: Semaphore::new(MAX_CONCURRENT_FETCHES),
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

impl WebPreviewFetcher {
    /// Whether one link is still there. Only a definite answer counts: a login wall or a
    /// timeout says nothing about whether the page exists.
    async fn check(&self, raw: &str) -> LinkHealth {
        let Ok(url) = Url::parse(raw) else {
            return LinkHealth::Unknown;
        };
        if !is_public_url(&url) {
            return LinkHealth::Unknown;
        }
        let Ok(_permit) = self.check_permits.acquire().await else {
            return LinkHealth::Unknown;
        };
        if let Some(Host::Domain(domain)) = url.host() {
            let lookup =
                tokio::time::timeout(CONNECT_TIMEOUT, tokio::net::lookup_host((domain, 443))).await;
            match lookup {
                Ok(Ok(_)) => {}
                Ok(Err(error)) if is_missing_host(&error.to_string()) => {
                    return LinkHealth::Broken;
                }
                // A resolver hiccup says nothing about whether the site exists.
                _ => return LinkHealth::Unknown,
            }
        }
        match self
            .client
            .get(url.clone())
            .header(ACCEPT, "text/html,*/*")
            .send()
            .await
        {
            Ok(response) => judge(response.status().as_u16(), &url, response.url()),
            Err(_) => LinkHealth::Unknown,
        }
    }
}

impl LinkChecker for WebPreviewFetcher {
    async fn online(&self) -> bool {
        tokio::net::lookup_host(("github.com", 443)).await.is_ok()
    }

    async fn check_all(&self, urls: &[String]) -> Vec<LinkHealth> {
        join_all(urls.iter().map(|url| self.check(url))).await
    }
}

/// Whether a DNS failure definitely means the name doesn't exist, on any platform.
fn is_missing_host(message: &str) -> bool {
    ["No such host", "Name or service not known", "or not known"]
        .iter()
        .any(|text| message.contains(text))
}

fn same_site(a: &Url, b: &Url) -> bool {
    let host = |url: &Url| {
        url.host_str()
            .unwrap_or_default()
            .trim_start_matches("www.")
            .to_ascii_lowercase()
    };
    let (a, b) = (host(a), host(b));
    a == b || a.ends_with(&format!(".{b}")) || b.ends_with(&format!(".{a}"))
}

fn judge(status: u16, requested: &Url, landed: &Url) -> LinkHealth {
    match status {
        404 | 410 => LinkHealth::Broken,
        200..=299 if same_site(requested, landed) => LinkHealth::Ok,
        200..=299 => LinkHealth::Moved,
        _ => LinkHealth::Unknown,
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

/// http(s) only; literal IP hosts must be public and `localhost` names are refused. Other
/// names are checked by the resolver when Rust fetches; for image and icon addresses the
/// webview resolves them, so a name pointing at a private address is not caught here.
fn is_public_url(url: &Url) -> bool {
    if !matches!(url.scheme(), "http" | "https") {
        return false;
    }
    match url.host() {
        Some(Host::Ipv4(ip)) => is_public_ip(IpAddr::V4(ip)),
        Some(Host::Ipv6(ip)) => is_public_ip(IpAddr::V6(ip)),
        Some(Host::Domain(domain)) => {
            let name = domain.trim_end_matches('.').to_ascii_lowercase();
            name != "localhost" && !name.ends_with(".localhost")
        }
        None => false,
    }
}

fn is_public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            let [a, b, c, _] = v4.octets();
            let shared_cgnat = a == 100 && (64..=127).contains(&b);
            let ietf_protocol = a == 192 && b == 0 && c == 0;
            let benchmarking = a == 198 && (b == 18 || b == 19);
            !(v4.is_private()
                || v4.is_loopback()
                || v4.is_link_local()
                || v4.is_broadcast()
                || v4.is_documentation()
                || v4.is_unspecified()
                || v4.is_multicast()
                || shared_cgnat
                || ietf_protocol
                || benchmarking
                || a == 0
                || a >= 240)
        }
        IpAddr::V6(v6) => {
            if let Some(v4) = embedded_ipv4(v6) {
                return is_public_ip(IpAddr::V4(v4));
            }
            let first = v6.segments()[0];
            let unique_local = (first & 0xfe00) == 0xfc00;
            let link_local = (first & 0xffc0) == 0xfe80;
            let site_local = (first & 0xffc0) == 0xfec0;
            let segments = v6.segments();
            let documentation = segments[..2] == [0x2001, 0x0db8];
            let discard = segments[..4] == [0x0100, 0, 0, 0];
            let local_nat64 = segments[..3] == [0x64, 0xff9b, 0x1];
            !(v6.is_loopback()
                || v6.is_unspecified()
                || v6.is_multicast()
                || unique_local
                || link_local
                || site_local
                || documentation
                || discard
                || local_nat64)
        }
    }
}

/// The IPv4 address an IPv6 address carries and routes to: IPv4-mapped (`::ffff:a.b.c.d`),
/// IPv4-compatible (`::a.b.c.d`), NAT64 (`64:ff9b::/96`) and 6to4 (`2002::/16`).
fn embedded_ipv4(v6: Ipv6Addr) -> Option<Ipv4Addr> {
    let s = v6.segments();
    let join = |high: u16, low: u16| Ipv4Addr::from((u32::from(high) << 16) | u32::from(low));
    if let Some(v4) = v6.to_ipv4() {
        Some(v4)
    } else if s[..6] == [0x64, 0xff9b, 0, 0, 0, 0] {
        Some(join(s[6], s[7]))
    } else if s[0] == 0x2002 {
        Some(join(s[1], s[2]))
    } else {
        None
    }
}

#[cfg(test)]
mod link_check_tests {
    use super::*;

    fn url(text: &str) -> Url {
        Url::parse(text).unwrap()
    }

    #[test]
    fn only_404_and_410_mean_a_page_is_gone() {
        let page = url("https://a.example/x");
        assert_eq!(judge(404, &page, &page), LinkHealth::Broken);
        assert_eq!(judge(410, &page, &page), LinkHealth::Broken);
        for status in [401, 403, 429, 500, 503] {
            assert_eq!(judge(status, &page, &page), LinkHealth::Unknown, "{status}");
        }
    }

    #[test]
    fn only_a_definite_no_such_host_means_a_domain_is_gone() {
        assert!(is_missing_host("No such host is known. (os error 11001)"));
        assert!(is_missing_host(
            "failed to lookup address information: Name or service not known"
        ));
        assert!(is_missing_host(
            "failed to lookup address information: nodename nor servname provided, or not known"
        ));
        assert!(!is_missing_host(
            "failed to lookup address information: Temporary failure in name resolution"
        ));
        assert!(!is_missing_host("A non-recoverable error occurred"));
    }

    #[test]
    fn a_success_on_the_same_site_is_fine() {
        let page = url("https://www.a.example/x");
        assert_eq!(
            judge(200, &page, &url("https://a.example/y")),
            LinkHealth::Ok
        );
    }

    #[test]
    fn a_success_on_another_site_means_it_moved() {
        assert_eq!(
            judge(200, &url("https://a.example/x"), &url("https://b.example/")),
            LinkHealth::Moved
        );
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

/// Resolves an image or icon address. The webview loads it directly, so it gets the same
/// public-address check as a page fetch: a page can't point the app at the local network.
fn resolve_web_url(base: &Url, value: &str) -> Option<String> {
    let url = base.join(value.trim()).ok()?;
    is_public_url(&url).then(|| url.into())
}

fn default_icon(page_url: &Url) -> Option<String> {
    resolve_web_url(page_url, "/favicon.ico")
}

#[cfg(test)]
mod tests {
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
    fn blocks_reserved_ranges_and_private_ipv4_inside_ipv6() {
        let blocked = [
            "192.0.0.8",              // IETF protocol assignments, 192.0.0.0/24
            "198.18.0.1",             // benchmarking, 198.18.0.0/15
            "198.19.255.254",         // benchmarking, upper half
            "::127.0.0.1",            // IPv4-compatible loopback
            "::10.0.0.1",             // IPv4-compatible private
            "::ffff:192.168.1.1",     // IPv4-mapped private
            "::ffff:169.254.169.254", // IPv4-mapped link-local (cloud metadata)
            "64:ff9b::7f00:1",        // NAT64 of 127.0.0.1
            "64:ff9b::a9fe:a9fe",     // NAT64 of 169.254.169.254
            "2002:c0a8:101::1",       // 6to4 of 192.168.1.1
            "2002:7f00:1::",          // 6to4 of 127.0.0.1
            "fec0::1",                // site-local, fec0::/10
            "feff::1",                // site-local, top of fec0::/10
            "2001:db8::1",            // documentation, 2001:db8::/32
            "100::1",                 // discard, 100::/64
            "64:ff9b:1::808:808",     // local-use NAT64, 64:ff9b:1::/48
        ];
        for raw in blocked {
            let ip: IpAddr = raw.parse().unwrap();
            assert!(!is_public_ip(ip), "{raw} should be blocked");
        }

        let public = [
            "192.0.1.1",         // just past 192.0.0.0/24
            "198.20.0.1",        // just past 198.18.0.0/15
            "64:ff9b::6810:1",   // NAT64 of public 104.16.0.1
            "2002:6810:1::1",    // 6to4 of public 104.16.0.1
            "::ffff:104.16.0.1", // IPv4-mapped public
        ];
        for raw in public {
            let ip: IpAddr = raw.parse().unwrap();
            assert!(is_public_ip(ip), "{raw} should be public");
        }
    }

    #[test]
    fn drops_images_and_icons_that_point_at_private_addresses() {
        let html = r#"<head>
            <meta property="og:image" content="http://192.168.1.1/admin.png">
            <link rel="icon" href="http://[::ffff:127.0.0.1]:8080/icon.png">
        </head>"#;

        let preview = extract_preview(html, &page());

        assert_eq!(preview.image, None);
        // The private icon is dropped, so the site's own favicon is used instead.
        assert_eq!(
            preview.icon.as_deref(),
            Some("https://reactbits.dev/favicon.ico")
        );
    }

    #[test]
    fn drops_the_default_icon_of_a_private_page() {
        let html = r#"<meta property="og:image" content="/cover.png">"#;
        let local = Url::parse("http://localhost:3000/").unwrap();

        let preview = extract_preview(html, &local);

        assert_eq!(preview.image, None);
        assert_eq!(preview.icon, None);
    }

    #[test]
    fn rejects_non_public_urls_before_connecting() {
        for raw in [
            "http://127.0.0.1/",
            "http://localhost:1420/",
            "http://LOCALHOST./",
            "http://app.localhost/",
            "http://a.b.localhost./x.png",
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
