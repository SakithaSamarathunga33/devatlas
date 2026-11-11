//! Reads news for Discovery: official blog feeds (RSS/Atom) and Hacker News's front page.
//!
//! Only the feed addresses in `devatlas_application::news::NEWS_SOURCES` (passed in by the
//! use case) and the Hacker News search API are requested. Redirects must stay on https,
//! no credentials are sent, responses are bounded in time and size, feed HTML is reduced to
//! plain text, and answers are cached so reopening the view does not hit every blog again.

use std::collections::HashMap;
use std::sync::{Mutex, MutexGuard, PoisonError};
use std::time::{Duration, Instant};

use devatlas_application::news::{FeedEntry, FeedReader, TopStory, TopStorySource};
use devatlas_application::rankings::{LanguageRanking, RankingIndex};
use devatlas_application::star_history::StarBoards;
use futures_util::future::join_all;
use reqwest::header::ACCEPT;
use reqwest::redirect;
use scraper::Html;
use serde::Deserialize;
use tokio::sync::Semaphore;

const TOP_STORIES_URL: &str = "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=40";
const FEED_CACHE_FOR: Duration = Duration::from_secs(30 * 60);
const STORY_CACHE_FOR: Duration = Duration::from_secs(10 * 60);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(12);
const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const MAX_RESPONSE_BYTES: usize = 4 * 1024 * 1024;
const MAX_REDIRECTS: usize = 3;
const MAX_CONCURRENT_REQUESTS: usize = 8;
/// Summaries are cut to about two lines of text.
const SUMMARY_CHARS: usize = 220;
const USER_AGENT: &str = concat!("DevAtlas/", env!("CARGO_PKG_VERSION"), " news reader");
const FEED_ACCEPT: &str =
    "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8";

#[derive(Debug, thiserror::Error)]
pub enum NewsError {
    #[error("the site answered with status {0}")]
    Status(u16),
    #[error("the site could not be reached: {0}")]
    Http(#[from] reqwest::Error),
    #[error("the response was larger than expected")]
    TooLarge,
    #[error("the feed could not be read: {0}")]
    Feed(#[from] feed_rs::parser::ParseFeedError),
    #[error("the response was not in the expected format: {0}")]
    Format(#[from] serde_json::Error),
    #[error("the news reader is shutting down")]
    Closed,
    #[error("the page did not contain the expected data")]
    Unrecognized,
}

type FeedCache = HashMap<&'static str, (Instant, Vec<FeedEntry>)>;

/// A poisoned lock only means another read panicked; the cached data is still valid.
pub(crate) fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(PoisonError::into_inner)
}

pub struct NewsReader {
    client: reqwest::Client,
    permits: Semaphore,
    feeds: Mutex<FeedCache>,
    stories: Mutex<Option<(Instant, Vec<TopStory>)>>,
    /// Language-popularity indexes; see `rankings.rs`.
    pub(crate) rankings: Mutex<HashMap<RankingIndex, (Instant, LanguageRanking)>>,
    /// star-history.com's repository rankings; see `star_history.rs`.
    pub(crate) star_boards: Mutex<Option<(Instant, StarBoards)>>,
}

impl NewsReader {
    pub fn new() -> Result<Self, NewsError> {
        let client = reqwest::Client::builder()
            .user_agent(USER_AGENT)
            .timeout(REQUEST_TIMEOUT)
            .connect_timeout(CONNECT_TIMEOUT)
            .redirect(redirect::Policy::custom(|attempt| {
                if attempt.previous().len() >= MAX_REDIRECTS {
                    attempt.error("too many redirects")
                } else if attempt.url().scheme() != "https" {
                    attempt.error("redirect away from https")
                } else {
                    attempt.follow()
                }
            }))
            .build()?;
        Ok(Self {
            client,
            permits: Semaphore::new(MAX_CONCURRENT_REQUESTS),
            feeds: Mutex::default(),
            stories: Mutex::default(),
            rankings: Mutex::default(),
            star_boards: Mutex::default(),
        })
    }

    pub(crate) async fn get(&self, url: &str, accept: &str) -> Result<Vec<u8>, NewsError> {
        let _permit = self
            .permits
            .acquire()
            .await
            .map_err(|_| NewsError::Closed)?;
        let mut response = self.client.get(url).header(ACCEPT, accept).send().await?;
        if !response.status().is_success() {
            return Err(NewsError::Status(response.status().as_u16()));
        }
        let mut body = Vec::new();
        while let Some(chunk) = response.chunk().await? {
            body.extend_from_slice(&chunk);
            if body.len() > MAX_RESPONSE_BYTES {
                return Err(NewsError::TooLarge);
            }
        }
        Ok(body)
    }

    async fn read(&self, url: &'static str) -> Result<Vec<FeedEntry>, NewsError> {
        let cached = lock(&self.feeds)
            .get(url)
            .filter(|(fetched_at, _)| fetched_at.elapsed() < FEED_CACHE_FOR)
            .map(|(_, entries)| entries.clone());
        if let Some(entries) = cached {
            return Ok(entries);
        }
        let entries = parse_feed(&self.get(url, FEED_ACCEPT).await?)?;
        lock(&self.feeds).insert(url, (Instant::now(), entries.clone()));
        Ok(entries)
    }
}

impl FeedReader for NewsReader {
    type Error = NewsError;

    async fn read_all(&self, urls: &[&'static str]) -> Vec<Result<Vec<FeedEntry>, NewsError>> {
        join_all(urls.iter().map(|&url| async move {
            let result = self.read(url).await;
            if let Err(error) = &result {
                tracing::warn!(%error, url, "news feed unavailable");
            }
            result
        }))
        .await
    }
}

impl TopStorySource for NewsReader {
    type Error = NewsError;

    async fn top_stories(&self) -> Result<Vec<TopStory>, NewsError> {
        let cached = lock(&self.stories)
            .as_ref()
            .filter(|(fetched_at, _)| fetched_at.elapsed() < STORY_CACHE_FOR)
            .map(|(_, stories)| stories.clone());
        if let Some(stories) = cached {
            return Ok(stories);
        }
        let stories = parse_stories(&self.get(TOP_STORIES_URL, "application/json").await?)?;
        *lock(&self.stories) = Some((Instant::now(), stories.clone()));
        Ok(stories)
    }
}

/// Entries of an RSS or Atom document. The use case drops entries without an http(s) link.
fn parse_feed(body: &[u8]) -> Result<Vec<FeedEntry>, feed_rs::parser::ParseFeedError> {
    let feed = feed_rs::parser::parse(body)?;
    Ok(feed
        .entries
        .into_iter()
        .filter_map(|entry| {
            let url = entry
                .links
                .iter()
                .find(|link| link.rel.as_deref().is_none_or(|rel| rel == "alternate"))
                .or_else(|| entry.links.first())
                .map(|link| link.href.trim().to_owned())?;
            let summary = entry
                .summary
                .map(|text| text.content)
                .or_else(|| entry.content.and_then(|content| content.body))
                .map(|html| shorten(&plain_text(&html)));
            Some(FeedEntry {
                title: entry
                    .title
                    .map(|text| plain_text(&text.content))
                    .unwrap_or_default(),
                url,
                published_at: entry
                    .published
                    .or(entry.updated)
                    .map(|date| date.timestamp_millis()),
                summary,
            })
        })
        .collect())
}

/// Text of an HTML snippet with whitespace collapsed (feeds put markup in titles and
/// summaries; the UI only ever shows plain text).
pub(crate) fn plain_text(html: &str) -> String {
    let text = if html.contains(['<', '&']) {
        Html::parse_fragment(html)
            .root_element()
            .text()
            .collect::<Vec<_>>()
            .join(" ")
    } else {
        html.to_owned()
    };
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Cuts text to about `SUMMARY_CHARS` characters at a word boundary.
fn shorten(text: &str) -> String {
    if text.chars().count() <= SUMMARY_CHARS {
        return text.to_owned();
    }
    let cut: String = text.chars().take(SUMMARY_CHARS).collect();
    let cut = cut.rsplit_once(' ').map_or(cut.as_str(), |(head, _)| head);
    format!("{}…", cut.trim_end_matches([',', '.', ';', ':', ' ']))
}

#[derive(Deserialize)]
struct HnSearch {
    hits: Vec<HnHit>,
}

#[derive(Deserialize)]
struct HnHit {
    title: Option<String>,
    url: Option<String>,
    points: Option<u32>,
    num_comments: Option<u32>,
    #[serde(rename = "objectID")]
    object_id: String,
    created_at_i: i64,
}

/// Front-page stories; "Ask HN" posts without a link point at their discussion.
fn parse_stories(body: &[u8]) -> Result<Vec<TopStory>, serde_json::Error> {
    let search: HnSearch = serde_json::from_slice(body)?;
    Ok(search
        .hits
        .into_iter()
        .filter_map(|hit| {
            let title = hit.title.map(|title| plain_text(&title))?;
            if title.is_empty() || !hit.object_id.bytes().all(|byte| byte.is_ascii_digit()) {
                return None;
            }
            let discussion_url = format!("https://news.ycombinator.com/item?id={}", hit.object_id);
            Some(TopStory {
                title,
                url: hit
                    .url
                    .filter(|url| !url.trim().is_empty())
                    .unwrap_or_else(|| discussion_url.clone()),
                discussion_url,
                points: hit.points.unwrap_or_default(),
                comments: hit.num_comments.unwrap_or_default(),
                published_at: hit.created_at_i.saturating_mul(1000),
            })
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_rss_items_as_plain_text() {
        let rss = br#"<?xml version="1.0"?>
          <rss version="2.0"><channel><title>Blog</title>
            <item>
              <title>Announcing &lt;b&gt;Rust&lt;/b&gt; 1.95</title>
              <link>https://blog.rust-lang.org/2026/11/06/Rust-1.95.0/</link>
              <pubDate>Fri, 06 Nov 2026 12:00:00 GMT</pubDate>
              <description>&lt;p&gt;The Rust team is   happy to announce&lt;/p&gt;</description>
            </item>
          </channel></rss>"#;

        let entries = parse_feed(rss).unwrap();

        assert_eq!(
            entries,
            [FeedEntry {
                title: "Announcing Rust 1.95".to_owned(),
                url: "https://blog.rust-lang.org/2026/11/06/Rust-1.95.0/".to_owned(),
                published_at: Some(1_793_966_400_000),
                summary: Some("The Rust team is happy to announce".to_owned()),
            }]
        );
    }

    #[test]
    fn reads_atom_entries_and_prefers_the_alternate_link() {
        let atom = br#"<?xml version="1.0" encoding="utf-8"?>
          <feed xmlns="http://www.w3.org/2005/Atom"><title>Go</title><id>go</id>
            <updated>2026-11-01T00:00:00Z</updated>
            <entry>
              <title>Go 1.27 is released</title><id>go-1.27</id>
              <link rel="replies" href="https://go.dev/comments"/>
              <link rel="alternate" href="https://go.dev/blog/go1.27"/>
              <updated>2026-11-01T00:00:00Z</updated>
            </entry>
          </feed>"#;

        let entries = parse_feed(atom).unwrap();

        assert_eq!(entries[0].url, "https://go.dev/blog/go1.27");
        assert_eq!(entries[0].published_at, Some(1_793_491_200_000));
        assert_eq!(entries[0].summary, None);
    }

    #[test]
    fn rejects_documents_that_are_not_feeds() {
        assert!(parse_feed(b"<html><body>Not a feed</body></html>").is_err());
    }

    #[test]
    fn shortens_long_summaries_at_a_word() {
        let long = "word ".repeat(100);

        let short = shorten(long.trim());

        assert!(short.ends_with("word…"));
        assert!(short.chars().count() <= SUMMARY_CHARS + 1);
        assert_eq!(shorten("brief"), "brief");
    }

    #[test]
    fn reads_hacker_news_front_page_stories() {
        let body = br#"{"hits":[
          {"title":"Show HN: A tiny database","url":"https://example.com/db","points":321,
           "num_comments":45,"objectID":"50424581","created_at_i":1794312000},
          {"title":"Ask HN: What are you working on?","url":null,"points":120,
           "num_comments":300,"objectID":"50424582","created_at_i":1794312100},
          {"title":"Odd id","url":"https://example.com","points":1,"num_comments":0,
           "objectID":"../x","created_at_i":0}
        ]}"#;

        let stories = parse_stories(body).unwrap();

        assert_eq!(stories.len(), 2);
        assert_eq!(stories[0].url, "https://example.com/db");
        assert_eq!(
            stories[0].discussion_url,
            "https://news.ycombinator.com/item?id=50424581"
        );
        assert_eq!(stories[0].published_at, 1_794_312_000_000);
        assert_eq!(
            stories[1].url, stories[1].discussion_url,
            "Ask HN links to the thread"
        );
    }
}
