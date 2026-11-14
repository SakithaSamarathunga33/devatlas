//! What DevAtlas tells an AI coding agent: the user's own library, searched, looked up, and
//! matched to a project's dependencies. Everything here only reads.

use std::path::Path;

use devatlas_domain::resource::ResourceCategory;
use serde::Serialize;
use url::Url;

use crate::library::LibraryItem;
use crate::link_health::LinkHealth;
use crate::organizer::{Group, ReadingStatus};
use crate::snippets::Snippet;

pub const DEFAULT_RESULTS: usize = 10;
pub const MAX_RESULTS: usize = 50;
/// Shorter dependency names (`fs`, `ws`) match too much unrelated text to be useful.
const MIN_TERM_LEN: usize = 3;
const MATCHES_PER_DEPENDENCY: usize = 5;
/// Titles and tags come from web pages and other people's repositories.
const MAX_TEXT_CHARS: usize = 200;
pub const MAX_SNIPPET_CHARS: usize = 4_000;

/// Invisible characters that can smuggle text past a reader: zero-width and bidi controls,
/// the soft hyphen, the byte-order mark and the Unicode tag block.
fn is_hidden(c: char) -> bool {
    matches!(c as u32,
        0x00AD | 0x200B..=0x200F | 0x202A..=0x202E | 0x2060..=0x2064 | 0x2066..=0x206F
        | 0xFEFF | 0xE0000..=0xE007F)
}

/// Untrusted text made safe to hand to an agent: no control or hidden characters, single
/// spaces, at most `max` characters.
pub fn clean_text(text: &str, max: usize) -> String {
    let visible: String = text
        .chars()
        .filter(|&c| !is_hidden(c))
        .map(|c| if c.is_control() { ' ' } else { c })
        .collect();
    let joined = visible.split_whitespace().collect::<Vec<_>>().join(" ");
    if joined.chars().count() <= max {
        return joined;
    }
    // One character is left for the ellipsis.
    let kept: String = joined.chars().take(max.saturating_sub(1)).collect();
    format!("{}…", kept.trim_end())
}

/// The address without the parts that can carry secrets: the query and fragment (signed links,
/// tokens, reset links) and the user name and password. Used for every address DevAtlas hands
/// to someone else, an agent or Community.
pub fn without_secrets(url: &Url) -> Url {
    let mut public = url.clone();
    public.set_query(None);
    public.set_fragment(None);
    // Both fail only for addresses that cannot hold credentials, which then hold none.
    let _ = public.set_username("");
    let _ = public.set_password(None);
    public
}

fn shareable_url(url: &str) -> String {
    match Url::parse(url) {
        Ok(parsed) => without_secrets(&parsed).into(),
        Err(_) => clean_text(url, MAX_TEXT_CHARS),
    }
}

/// One saved resource, as an agent sees it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceSummary {
    pub id: String,
    pub title: String,
    pub url: String,
    pub category: ResourceCategory,
    pub tags: Vec<String>,
    /// The user's own words: why they saved it, what they chose it over.
    pub note: Option<String>,
    pub status: Option<ReadingStatus>,
    pub collections: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SnippetSummary {
    pub title: String,
    pub language: Option<String>,
    pub code: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceDetails {
    #[serde(flatten)]
    pub summary: ResourceSummary,
    pub added_at: Option<i64>,
    pub last_opened_at: Option<i64>,
    pub link_health: Option<LinkHealth>,
    pub snippets: Vec<SnippetSummary>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Ecosystem {
    Npm,
    Cargo,
    Go,
    Python,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Dependency {
    pub name: String,
    pub ecosystem: Ecosystem,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct StackMatch {
    pub dependency: Dependency,
    pub resources: Vec<ResourceSummary>,
}

/// A project's dependencies, and what the user has saved about them.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectStack {
    pub dependencies: Vec<Dependency>,
    pub saved: Vec<StackMatch>,
}

/// How often agents have looked things up.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentUsage {
    pub lookups: usize,
    /// Unix milliseconds of the most recent lookup.
    pub last_at: Option<i64>,
}

/// Port: records agent lookups and counts them.
pub trait UsageLog {
    type Error: std::error::Error;

    fn record(&self, tool: &str, at: i64) -> Result<(), Self::Error>;
    fn since(&self, since: i64) -> Result<AgentUsage, Self::Error>;
}

const WEEK_MS: i64 = 7 * 24 * 60 * 60 * 1000;

/// Lookups in the last seven days.
pub fn usage_this_week<L: UsageLog>(log: &L, now_ms: i64) -> Result<AgentUsage, L::Error> {
    log.since(now_ms - WEEK_MS)
}

/// Port: reads the dependencies declared in a project folder's manifests.
pub trait ProjectManifests {
    type Error: std::error::Error;

    fn dependencies(&self, dir: &Path) -> Result<Vec<Dependency>, Self::Error>;
}

fn summary(item: &LibraryItem, groups: &[Group]) -> ResourceSummary {
    ResourceSummary {
        id: item.resource.id.clone(),
        title: clean_text(&item.resource.title, MAX_TEXT_CHARS),
        url: shareable_url(&item.resource.url),
        category: item.resource.category,
        tags: item
            .tags
            .iter()
            .map(|tag| clean_text(tag, MAX_TEXT_CHARS))
            .filter(|tag| !tag.is_empty())
            .collect(),
        note: item.note.clone(),
        status: item.status,
        collections: groups
            .iter()
            .filter(|group| group.resource_ids.contains(&item.resource.id))
            .map(|group| group.name.clone())
            .collect(),
    }
}

/// Whether `field` mentions `word`. Short words such as `c` must stand alone, or they would
/// match nearly every address.
fn mentions(field: &str, word: &str) -> bool {
    if word.chars().count() < MIN_TERM_LEN {
        contains_word(field, word)
    } else {
        field.contains(word)
    }
}

/// How well an item answers every word of the query; `None` when a word is missing.
fn score(summary: &ResourceSummary, words: &[String]) -> Option<u32> {
    let title = summary.title.to_lowercase();
    let tags = summary.tags.join(" ").to_lowercase();
    let collections = summary.collections.join(" ").to_lowercase();
    let note = summary.note.as_deref().unwrap_or_default().to_lowercase();
    let url = summary.url.to_lowercase();
    let mut total = 0;
    for word in words {
        let points = 3 * u32::from(mentions(&title, word))
            + 3 * u32::from(mentions(&tags, word))
            + 2 * u32::from(mentions(&collections, word))
            + 2 * u32::from(mentions(&note, word))
            + u32::from(mentions(&url, word));
        if points == 0 {
            return None;
        }
        total += points;
    }
    Some(total + u32::from(summary.status == Some(ReadingStatus::Using)))
}

/// The saved resources matching every word of `query`, best first.
pub fn search(
    items: &[LibraryItem],
    groups: &[Group],
    query: &str,
    limit: usize,
) -> Vec<ResourceSummary> {
    let words: Vec<String> = query
        .split_whitespace()
        // `+` and `#` belong to names such as C++ and C#.
        .map(|word| {
            word.trim_matches(|c: char| !(c.is_alphanumeric() || c == '+' || c == '#'))
                .to_lowercase()
        })
        .filter(|word| !word.is_empty())
        .collect();
    if words.is_empty() {
        return Vec::new();
    }
    let mut scored: Vec<(u32, ResourceSummary)> = items
        .iter()
        .map(|item| summary(item, groups))
        .filter_map(|summary| score(&summary, &words).map(|points| (points, summary)))
        .collect();
    scored.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.title.cmp(&b.1.title)));
    scored
        .into_iter()
        .take(limit.clamp(1, MAX_RESULTS))
        .map(|(_, summary)| summary)
        .collect()
}

/// One resource by its id or address, with everything the user added to it.
pub fn find(
    items: &[LibraryItem],
    groups: &[Group],
    snippets: &[Snippet],
    key: &str,
) -> Option<ResourceDetails> {
    let key = key.trim().trim_end_matches('/');
    let item = items
        .iter()
        .find(|item| item.resource.id == key || item.resource.url.trim_end_matches('/') == key)?;
    Some(ResourceDetails {
        summary: summary(item, groups),
        added_at: item.resource.added_at,
        last_opened_at: item.last_opened_at,
        link_health: item.link_health,
        snippets: snippets
            .iter()
            .filter(|snippet| snippet.resource_id.as_deref() == Some(item.resource.id.as_str()))
            .map(|snippet| SnippetSummary {
                title: snippet.title.clone(),
                language: snippet.language.clone(),
                code: snippet.code.chars().take(MAX_SNIPPET_CHARS).collect(),
            })
            .collect(),
    })
}

/// `needle` appears in `haystack` as a whole word, so `gin` doesn't match `plugin`.
fn contains_word(haystack: &str, needle: &str) -> bool {
    haystack.match_indices(needle).any(|(start, _)| {
        let before = haystack[..start].chars().next_back();
        let after = haystack[start + needle.len()..].chars().next();
        let is_word = |c: char| c.is_alphanumeric() || c == '+' || c == '#';
        !before.is_some_and(is_word) && !after.is_some_and(is_word)
    })
}

/// Whether `segment` is a Go major-version suffix such as `v2`.
fn is_major_version(segment: &str) -> bool {
    segment
        .strip_prefix('v')
        .is_some_and(|digits| !digits.is_empty() && digits.chars().all(|c| c.is_ascii_digit()))
}

/// Last path parts too common to name one package on their own (`@tauri-apps/cli`).
const GENERIC_NAMES: &[&str] = &[
    "api",
    "cli",
    "core",
    "types",
    "utils",
    "util",
    "common",
    "shared",
    "plugin",
    "plugins",
    "client",
    "server",
    "sdk",
    "config",
    "runtime",
    "compiler",
    "components",
    "icons",
    "theme",
    "lib",
    "web",
    "dom",
    "test",
    "testing",
    "base",
    "kit",
    "app",
];

/// The names a dependency is written as in titles, tags and addresses. `siblings` is every
/// dependency of the project: `@types/react` is about react, which is listed on its own.
fn terms(dependency: &Dependency, siblings: &[Dependency]) -> Vec<String> {
    let full = dependency.name.to_lowercase();
    // `github.com/foo/bar/v2` is `bar`, and `gopkg.in/yaml.v3` is `yaml`.
    let name = match full.rsplit_once('/') {
        Some((rest, last)) if is_major_version(last) => rest.to_owned(),
        _ => full,
    };
    let last = name.rsplit('/').next().unwrap_or(&name);
    let last = match last.rsplit_once('.') {
        Some((stem, version)) if is_major_version(version) => stem,
        _ => last,
    }
    .to_owned();
    let full = name.trim_start_matches('@').to_owned();
    let is_sibling = siblings.iter().any(|other| {
        other.ecosystem == dependency.ecosystem && other.name.eq_ignore_ascii_case(&last)
    });
    let mut terms = vec![full.clone()];
    if last == full || !(GENERIC_NAMES.contains(&last.as_str()) || is_sibling) {
        terms.push(last);
    } else if let Some((scope, _)) = name.strip_prefix('@').and_then(|n| n.split_once('/')) {
        // `@tauri-apps/cli` is still about tauri-apps.
        if !GENERIC_NAMES.contains(&scope) {
            terms.push(scope.to_owned());
        }
    }
    terms.dedup();
    terms.retain(|term| term.len() >= MIN_TERM_LEN);
    terms
}

fn matches_dependency(summary: &ResourceSummary, terms: &[String]) -> bool {
    let text = format!(
        "{} {} {}",
        summary.title,
        summary.tags.join(" "),
        summary.url
    )
    .to_lowercase();
    terms.iter().any(|term| contains_word(&text, term))
}

/// A project's dependencies and the saved resources about each of them.
pub fn stack<M: ProjectManifests>(
    manifests: &M,
    dir: &Path,
    items: &[LibraryItem],
    groups: &[Group],
) -> Result<ProjectStack, M::Error> {
    let dependencies = manifests.dependencies(dir)?;
    let summaries: Vec<ResourceSummary> = items.iter().map(|item| summary(item, groups)).collect();
    let saved = dependencies
        .iter()
        .filter_map(|dependency| {
            let terms = terms(dependency, &dependencies);
            let mut resources: Vec<ResourceSummary> = summaries
                .iter()
                .filter(|summary| matches_dependency(summary, &terms))
                .cloned()
                .collect();
            // What the developer wrote about, or uses, first.
            resources.sort_by_key(|summary| {
                (
                    summary.note.is_none(),
                    summary.status != Some(ReadingStatus::Using),
                )
            });
            resources.truncate(MATCHES_PER_DEPENDENCY);
            (!resources.is_empty()).then(|| StackMatch {
                dependency: dependency.clone(),
                resources,
            })
        })
        .collect();
    Ok(ProjectStack {
        dependencies,
        saved,
    })
}

#[cfg(test)]
mod tests {
    use std::convert::Infallible;

    use devatlas_domain::resource::{Resource, ResourceOrigin};

    use super::*;

    fn item(id: &str, title: &str, tags: &[&str], note: Option<&str>) -> LibraryItem {
        LibraryItem {
            resource: Resource {
                id: id.to_owned(),
                title: title.to_owned(),
                url: format!("https://{id}/"),
                host: id.split('/').next().unwrap_or(id).to_owned(),
                category: ResourceCategory::Tools,
                folder: String::new(),
                added_at: Some(1),
                origin: ResourceOrigin::DevAtlas,
            },
            is_new: false,
            category_override: None,
            status: None,
            tags: tags.iter().map(|tag| (*tag).to_owned()).collect(),
            note: note.map(str::to_owned),
            last_opened_at: None,
            link_health: None,
        }
    }

    fn library() -> Vec<LibraryItem> {
        vec![
            item(
                "motion.dev",
                "Motion",
                &["animation", "react"],
                Some("Chosen over GSAP"),
            ),
            item("recharts.org", "Recharts", &["charts", "react"], None),
            item(
                "github.com/gin-gonic/gin",
                "Gin web framework",
                &["go"],
                None,
            ),
            item("plugins.example", "Plugin catalogue", &[], None),
        ]
    }

    fn group(name: &str, ids: &[&str]) -> Group {
        Group {
            id: name.to_owned(),
            name: name.to_owned(),
            description: None,
            resource_ids: ids.iter().map(|id| (*id).to_owned()).collect(),
            created_at: 0,
        }
    }

    fn ids(results: &[ResourceSummary]) -> Vec<&str> {
        results.iter().map(|result| result.id.as_str()).collect()
    }

    #[test]
    fn search_needs_every_word_and_ranks_titles_and_tags_first() {
        let results = search(&library(), &[], "react charts", DEFAULT_RESULTS);

        assert_eq!(ids(&results), ["recharts.org"]);
        assert!(search(&library(), &[], "react", DEFAULT_RESULTS).len() == 2);
        assert!(search(&library(), &[], "  ", DEFAULT_RESULTS).is_empty());
    }

    #[test]
    fn search_reads_notes_and_collections() {
        let groups = [group("Client dashboard", &["recharts.org"])];

        assert_eq!(
            ids(&search(&library(), &groups, "gsap", 10)),
            ["motion.dev"]
        );
        assert_eq!(
            ids(&search(&library(), &groups, "dashboard", 10)),
            ["recharts.org"]
        );
    }

    #[test]
    fn search_caps_the_number_of_results() {
        assert_eq!(search(&library(), &[], "react", 1).len(), 1);
    }

    #[test]
    fn find_by_id_or_address_with_snippets() {
        let snippet = Snippet {
            id: "s".to_owned(),
            title: "Fade in".to_owned(),
            language: Some("tsx".to_owned()),
            code: "<motion.div />".to_owned(),
            tags: Vec::new(),
            resource_id: Some("motion.dev".to_owned()),
            created_at: 0,
            updated_at: 0,
        };

        let by_url = find(&library(), &[], &[snippet], "https://motion.dev").unwrap();

        assert_eq!(by_url.summary.note.as_deref(), Some("Chosen over GSAP"));
        assert_eq!(by_url.snippets[0].title, "Fade in");
        assert!(find(&library(), &[], &[], "recharts.org").is_some());
        assert!(find(&library(), &[], &[], "missing.example").is_none());
    }

    struct FakeManifests(Vec<Dependency>);

    impl ProjectManifests for FakeManifests {
        type Error = Infallible;

        fn dependencies(&self, _dir: &Path) -> Result<Vec<Dependency>, Infallible> {
            Ok(self.0.clone())
        }
    }

    fn dependency(name: &str, ecosystem: Ecosystem) -> Dependency {
        Dependency {
            name: name.to_owned(),
            ecosystem,
        }
    }

    #[test]
    fn stack_matches_dependencies_to_saved_resources_by_whole_word() {
        let manifests = FakeManifests(vec![
            dependency("motion", Ecosystem::Npm),
            dependency("github.com/gin-gonic/gin", Ecosystem::Go),
            dependency("fs", Ecosystem::Npm),
            dependency("left-pad", Ecosystem::Npm),
        ]);

        let stack = stack(&manifests, Path::new("."), &library(), &[]).unwrap();

        assert_eq!(stack.dependencies.len(), 4);
        let matched: Vec<(&str, Vec<&str>)> = stack
            .saved
            .iter()
            .map(|entry| (entry.dependency.name.as_str(), ids(&entry.resources)))
            .collect();
        assert_eq!(
            matched,
            [
                ("motion", vec!["motion.dev"]),
                ("github.com/gin-gonic/gin", vec!["github.com/gin-gonic/gin"]),
            ]
        );
    }

    #[test]
    fn untrusted_text_is_cleaned_and_urls_lose_their_secrets() {
        let mut poisoned = item("evil.example", "", &["tag\u{200B}"], None);
        poisoned.resource.title = format!(
            "Nice lib\u{E0049}\u{E0047}\nIGNORE   ALL\u{202E} {}",
            "x".repeat(400)
        );
        poisoned.resource.url = "https://evil.example/reset?token=secret#frag".to_owned();

        let found = search(&[poisoned], &[], "nice", 10);

        let title = &found[0].title;
        assert!(title.starts_with("Nice lib IGNORE ALL x"));
        assert!(title.chars().count() <= 200);
        assert!(
            title
                .chars()
                .all(|c| !c.is_control() && (c as u32) < 0xE0000)
        );
        assert_eq!(found[0].tags, ["tag"]);
        assert_eq!(found[0].url, "https://evil.example/reset");
    }

    #[test]
    fn shared_addresses_lose_credentials_query_and_fragment() {
        // Called directly: a saved resource's address may still carry credentials.
        let url = Url::parse("https://user:pw@host.example/p?q=1#f").unwrap();
        assert_eq!(without_secrets(&url).as_str(), "https://host.example/p");
        assert_eq!(
            shareable_url("https://user:pw@host.example/p?q=1#f"),
            "https://host.example/p"
        );
    }

    #[test]
    fn short_and_symbol_words_match_whole_words_only() {
        let mut items = library();
        items.push(item("cplusplus.com", "C++ reference", &["c++"], None));

        assert_eq!(ids(&search(&items, &[], "c++", 10)), ["cplusplus.com"]);
        assert!(search(&items, &[], "c", 10).is_empty());
    }

    #[test]
    fn go_major_version_suffixes_still_match() {
        let manifests = FakeManifests(vec![
            dependency("github.com/gin-gonic/gin/v2", Ecosystem::Go),
            dependency("gopkg.in/yaml.v3", Ecosystem::Go),
        ]);
        let mut items = library();
        items.push(item("yaml.example", "YAML for Go", &["yaml"], None));

        let stack = stack(&manifests, Path::new("."), &items, &[]).unwrap();

        let matched: Vec<&str> = stack
            .saved
            .iter()
            .map(|m| m.dependency.name.as_str())
            .collect();
        assert_eq!(matched, ["github.com/gin-gonic/gin/v2", "gopkg.in/yaml.v3"]);
    }

    #[test]
    fn stack_matches_put_noted_and_used_resources_first() {
        let mut items = vec![
            item("a.example", "React tips", &[], None),
            item("b.example", "React docs", &[], Some("Our reference")),
        ];
        items[0].status = None;
        let manifests = FakeManifests(vec![dependency("react", Ecosystem::Npm)]);

        let stack = stack(&manifests, Path::new("."), &items, &[]).unwrap();

        assert_eq!(ids(&stack.saved[0].resources), ["b.example", "a.example"]);
    }

    #[test]
    fn snippet_code_is_capped() {
        let snippet = Snippet {
            id: "s".to_owned(),
            title: "Long".to_owned(),
            language: None,
            code: "x".repeat(10_000),
            tags: Vec::new(),
            resource_id: Some("motion.dev".to_owned()),
            created_at: 0,
            updated_at: 0,
        };

        let details = find(&library(), &[], &[snippet], "motion.dev").unwrap();

        assert!(details.snippets[0].code.chars().count() <= MAX_SNIPPET_CHARS + 1);
    }

    #[test]
    fn scoped_packages_match_by_their_package_name() {
        let manifests = FakeManifests(vec![dependency("@acme/recharts", Ecosystem::Npm)]);

        let stack = stack(&manifests, Path::new("."), &library(), &[]).unwrap();

        assert_eq!(ids(&stack.saved[0].resources), ["recharts.org"]);
    }

    #[test]
    fn scoped_packages_skip_generic_and_sibling_last_names() {
        let manifests = FakeManifests(vec![
            dependency("@tauri-apps/cli", Ecosystem::Npm),
            dependency("@types/react", Ecosystem::Npm),
            dependency("react", Ecosystem::Npm),
            dependency("github.com/acme/react", Ecosystem::Go),
        ]);
        let mut items = library();
        items.push(item("cli.example", "Claude CLI tricks", &[], None));
        items.push(item("github.com/tauri-apps/tauri", "Tauri", &[], None));

        let stack = stack(&manifests, Path::new("."), &items, &[]).unwrap();

        let matched: Vec<(&str, Vec<&str>)> = stack
            .saved
            .iter()
            .map(|m| (m.dependency.name.as_str(), ids(&m.resources)))
            .collect();
        assert_eq!(
            matched,
            [
                ("@tauri-apps/cli", vec!["github.com/tauri-apps/tauri"]),
                ("react", vec!["motion.dev", "recharts.org"]),
                // Another ecosystem's `react` is not this module's sibling.
                ("github.com/acme/react", vec!["motion.dev", "recharts.org"]),
            ]
        );
    }
}
