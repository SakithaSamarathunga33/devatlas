//! Use cases for Discovery's News view: the latest posts from the official blogs of
//! languages, frameworks, databases and developer tools, and the stories developers are
//! discussing right now.

use std::cmp::Reverse;
use std::future::Future;

use serde::Serialize;
use url::Url;

/// Newest posts kept per source.
pub const POSTS_PER_SOURCE: usize = 6;
/// Top stories kept.
pub const TOP_STORIES: usize = 15;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum NewsCategory {
    Language,
    Framework,
    Database,
    Tool,
}

/// An official blog DevAtlas reads. This list is also the allow-list of feed addresses.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NewsSource {
    pub id: &'static str,
    pub name: &'static str,
    pub category: NewsCategory,
    #[serde(skip)]
    pub feed_url: &'static str,
}

const fn source(
    id: &'static str,
    name: &'static str,
    category: NewsCategory,
    feed_url: &'static str,
) -> NewsSource {
    NewsSource {
        id,
        name,
        category,
        feed_url,
    }
}

use NewsCategory::{Database, Framework, Language, Tool};

/// Every feed was checked to serve RSS or Atom when it was added.
pub const NEWS_SOURCES: &[NewsSource] = &[
    source(
        "rust",
        "Rust",
        Language,
        "https://blog.rust-lang.org/feed.xml",
    ),
    source("go", "Go", Language, "https://go.dev/blog/feed.atom"),
    source(
        "python",
        "Python",
        Language,
        "https://blog.python.org/feeds/posts/default",
    ),
    source(
        "typescript",
        "TypeScript",
        Language,
        "https://devblogs.microsoft.com/typescript/feed/",
    ),
    source(
        "nodejs",
        "Node.js",
        Language,
        "https://nodejs.org/en/feed/blog.xml",
    ),
    source(
        "kotlin",
        "Kotlin",
        Language,
        "https://blog.jetbrains.com/kotlin/feed/",
    ),
    source("swift", "Swift", Language, "https://www.swift.org/atom.xml"),
    source("java", "Java", Language, "https://inside.java/feed.xml"),
    source(
        "dotnet",
        ".NET",
        Language,
        "https://devblogs.microsoft.com/dotnet/feed/",
    ),
    source("php", "PHP", Language, "https://www.php.net/feed.atom"),
    source(
        "ruby",
        "Ruby",
        Language,
        "https://www.ruby-lang.org/en/feeds/news.rss",
    ),
    source("deno", "Deno", Language, "https://deno.com/feed"),
    source("dart", "Dart", Language, "https://medium.com/feed/dartlang"),
    source("zig", "Zig", Language, "https://ziglang.org/news/index.xml"),
    source("react", "React", Framework, "https://react.dev/rss.xml"),
    source("vue", "Vue", Framework, "https://blog.vuejs.org/feed.rss"),
    source(
        "svelte",
        "Svelte",
        Framework,
        "https://svelte.dev/blog/rss.xml",
    ),
    source(
        "nextjs",
        "Next.js",
        Framework,
        "https://nextjs.org/feed.xml",
    ),
    source(
        "angular",
        "Angular",
        Framework,
        "https://blog.angular.dev/feed",
    ),
    source(
        "tailwind",
        "Tailwind CSS",
        Framework,
        "https://tailwindcss.com/feeds/feed.xml",
    ),
    source(
        "flutter",
        "Flutter",
        Framework,
        "https://medium.com/feed/flutter",
    ),
    source(
        "postgresql",
        "PostgreSQL",
        Database,
        "https://www.postgresql.org/news.rss",
    ),
    source("mariadb", "MariaDB", Database, "https://mariadb.org/feed/"),
    source(
        "mongodb",
        "MongoDB",
        Database,
        "https://www.mongodb.com/company/blog/rss",
    ),
    source("redis", "Redis", Database, "https://redis.io/blog/feed/"),
    source(
        "supabase",
        "Supabase",
        Database,
        "https://supabase.com/rss.xml",
    ),
    source("duckdb", "DuckDB", Database, "https://duckdb.org/feed.xml"),
    source(
        "prisma",
        "Prisma",
        Database,
        "https://www.prisma.io/blog/rss.xml",
    ),
    source(
        "planetscale",
        "PlanetScale",
        Database,
        "https://planetscale.com/blog/feed.atom",
    ),
    source(
        "elastic",
        "Elastic",
        Database,
        "https://www.elastic.co/blog/feed",
    ),
    source("github", "GitHub", Tool, "https://github.blog/feed/"),
    source("docker", "Docker", Tool, "https://www.docker.com/feed/"),
    source(
        "kubernetes",
        "Kubernetes",
        Tool,
        "https://kubernetes.io/feed.xml",
    ),
    source(
        "vscode",
        "VS Code",
        Tool,
        "https://code.visualstudio.com/feed.xml",
    ),
    source(
        "chrome",
        "Chrome for Developers",
        Tool,
        "https://developer.chrome.com/static/blog/feed.xml",
    ),
];

/// A post as a feed reader returns it, before validation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FeedEntry {
    pub title: String,
    pub url: String,
    /// Unix milliseconds.
    pub published_at: Option<i64>,
    /// Plain text, already shortened.
    pub summary: Option<String>,
}

/// A post shown in the News view.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NewsItem {
    pub source_id: &'static str,
    pub title: String,
    pub url: String,
    pub published_at: Option<i64>,
    pub summary: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NewsFeed {
    pub sources: &'static [NewsSource],
    /// Newest first.
    pub items: Vec<NewsItem>,
    /// Ids of sources that could not be read this time.
    pub unavailable: Vec<&'static str>,
}

/// Port: reads several feeds; one result per URL, in the same order.
pub trait FeedReader {
    type Error: std::error::Error;

    fn read_all(
        &self,
        urls: &[&'static str],
    ) -> impl Future<Output = Vec<Result<Vec<FeedEntry>, Self::Error>>> + Send;
}

/// A story developers are discussing, with its discussion thread.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopStory {
    pub title: String,
    pub url: String,
    pub discussion_url: String,
    pub points: u32,
    pub comments: u32,
    /// Unix milliseconds.
    pub published_at: i64,
}

/// Port: today's most discussed stories, best first.
pub trait TopStorySource {
    type Error: std::error::Error;

    fn top_stories(&self) -> impl Future<Output = Result<Vec<TopStory>, Self::Error>> + Send;
}

/// The newest posts of every source (up to `POSTS_PER_SOURCE` each), newest first. A source
/// that cannot be read is listed in `unavailable` instead of failing the whole view; the
/// reader logs why.
pub async fn latest_news<R: FeedReader>(reader: &R) -> NewsFeed {
    let urls: Vec<&'static str> = NEWS_SOURCES.iter().map(|source| source.feed_url).collect();
    let results = reader.read_all(&urls).await;

    let mut items = Vec::new();
    let mut unavailable = Vec::new();
    for (source, result) in NEWS_SOURCES.iter().zip(results) {
        match result {
            Ok(entries) => items.extend(newest_posts(source.id, entries)),
            Err(_) => unavailable.push(source.id),
        }
    }
    items.sort_by_key(|item| Reverse(item.published_at));
    NewsFeed {
        sources: NEWS_SOURCES,
        items,
        unavailable,
    }
}

/// Valid posts (http(s) link, non-empty title) of one source, newest first.
fn newest_posts(source_id: &'static str, entries: Vec<FeedEntry>) -> Vec<NewsItem> {
    let mut posts: Vec<NewsItem> = entries
        .into_iter()
        .filter(|entry| is_web_url(&entry.url))
        .filter_map(|entry| {
            let title = entry.title.split_whitespace().collect::<Vec<_>>().join(" ");
            (!title.is_empty()).then_some(NewsItem {
                source_id,
                title,
                url: entry.url,
                published_at: entry.published_at,
                summary: entry.summary.filter(|text| !text.is_empty()),
            })
        })
        .collect();
    posts.sort_by_key(|post| Reverse(post.published_at));
    posts.truncate(POSTS_PER_SOURCE);
    posts
}

/// The best `TOP_STORIES` stories whose links are http(s).
pub async fn top_stories<S: TopStorySource>(source: &S) -> Result<Vec<TopStory>, S::Error> {
    let mut stories: Vec<TopStory> = source
        .top_stories()
        .await?
        .into_iter()
        .filter(|story| is_web_url(&story.url) && is_web_url(&story.discussion_url))
        .collect();
    stories.sort_by_key(|story| Reverse(story.points));
    stories.truncate(TOP_STORIES);
    Ok(stories)
}

fn is_web_url(raw: &str) -> bool {
    Url::parse(raw).is_ok_and(|url| matches!(url.scheme(), "http" | "https"))
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;
    use std::pin::pin;
    use std::task::{Context, Poll, Waker};

    use super::*;

    #[derive(Debug, thiserror::Error)]
    #[error("offline")]
    struct Offline;

    /// Answers each feed by its index: even ones succeed, odd ones fail.
    struct FakeReader;

    impl FeedReader for FakeReader {
        type Error = Offline;

        async fn read_all(&self, urls: &[&'static str]) -> Vec<Result<Vec<FeedEntry>, Offline>> {
            urls.iter()
                .enumerate()
                .map(|(index, _)| {
                    if index % 2 == 1 {
                        return Err(Offline);
                    }
                    let base = i64::try_from(index).unwrap_or_default() * 1_000;
                    Ok((0..8)
                        .map(|n| FeedEntry {
                            title: format!("  Post\n {n} "),
                            url: format!("https://example.com/{index}/{n}"),
                            published_at: Some(base + n),
                            summary: Some(String::new()),
                        })
                        .chain([FeedEntry {
                            title: "Script".to_owned(),
                            url: "javascript:alert(1)".to_owned(),
                            published_at: Some(i64::MAX),
                            summary: None,
                        }])
                        .collect())
                })
                .collect()
        }
    }

    struct FakeStories(Vec<TopStory>);

    impl TopStorySource for FakeStories {
        type Error = Offline;

        async fn top_stories(&self) -> Result<Vec<TopStory>, Offline> {
            Ok(self.0.clone())
        }
    }

    fn block_on<F: Future>(future: F) -> F::Output {
        let mut future = pin!(future);
        let mut cx = Context::from_waker(Waker::noop());
        loop {
            if let Poll::Ready(output) = future.as_mut().poll(&mut cx) {
                return output;
            }
        }
    }

    fn story(title: &str, url: &str, points: u32) -> TopStory {
        TopStory {
            title: title.to_owned(),
            url: url.to_owned(),
            discussion_url: "https://news.ycombinator.com/item?id=1".to_owned(),
            points,
            comments: 0,
            published_at: 0,
        }
    }

    #[test]
    fn sources_have_unique_ids_and_https_feeds() {
        let ids: HashSet<&str> = NEWS_SOURCES.iter().map(|source| source.id).collect();
        assert_eq!(ids.len(), NEWS_SOURCES.len());
        assert!(
            NEWS_SOURCES
                .iter()
                .all(|source| source.feed_url.starts_with("https://"))
        );
    }

    #[test]
    fn keeps_the_newest_valid_posts_per_source_and_reports_failures() {
        let feed = block_on(latest_news(&FakeReader));

        let rust: Vec<&NewsItem> = feed
            .items
            .iter()
            .filter(|item| item.source_id == NEWS_SOURCES[0].id)
            .collect();
        assert_eq!(rust.len(), POSTS_PER_SOURCE);
        assert_eq!(
            rust[0].title, "Post 7",
            "whitespace is collapsed, newest first"
        );
        assert!(rust.iter().all(|item| item.summary.is_none()));
        assert!(
            feed.items
                .iter()
                .all(|item| item.url.starts_with("https://"))
        );
        assert_eq!(feed.unavailable[0], NEWS_SOURCES[1].id);
        assert!(
            feed.items
                .windows(2)
                .all(|pair| pair[0].published_at >= pair[1].published_at)
        );
    }

    #[test]
    fn ranks_top_stories_by_points_and_drops_unsafe_links() {
        let stories = FakeStories(vec![
            story("Second", "https://b.example", 50),
            story("Script", "javascript:alert(1)", 999),
            story("First", "https://a.example", 300),
        ]);

        let top = block_on(top_stories(&stories)).unwrap();

        let titles: Vec<&str> = top.iter().map(|story| story.title.as_str()).collect();
        assert_eq!(titles, ["First", "Second"]);
    }
}
