//! Developer resources: links worth keeping, classified by what they are.

use serde::Serialize;
use url::Url;

/// What kind of developer resource a link points to.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ResourceCategory {
    UiComponents,
    Inspiration,
    Animation,
    Icons,
    Tools,
    Cloud,
    Other,
}

/// Known hosts per category; a rule matches the host itself or any of its subdomains.
// ponytail: static host table; replace with user-editable rules once resources are persisted.
const HOST_RULES: &[(&str, ResourceCategory)] = &[
    // UI component libraries
    ("kokonutui.com", ResourceCategory::UiComponents),
    ("aceternity.com", ResourceCategory::UiComponents),
    ("magicui.design", ResourceCategory::UiComponents),
    ("reactbits.dev", ResourceCategory::UiComponents),
    ("astryx.atmeta.com", ResourceCategory::UiComponents),
    ("interior.dev", ResourceCategory::UiComponents),
    ("uiverse.io", ResourceCategory::UiComponents),
    ("uilora.com", ResourceCategory::UiComponents),
    ("reactdrops.dev", ResourceCategory::UiComponents),
    ("bklit.com", ResourceCategory::UiComponents),
    ("css-loaders.com", ResourceCategory::UiComponents),
    ("cssloaders.colorion.co", ResourceCategory::UiComponents),
    ("ui.shadcn.com", ResourceCategory::UiComponents),
    // Design inspiration
    ("navbar.gallery", ResourceCategory::Inspiration),
    ("footer.design", ResourceCategory::Inspiration),
    ("cta.gallery", ResourceCategory::Inspiration),
    ("supahero.io", ResourceCategory::Inspiration),
    ("mobbin.com", ResourceCategory::Inspiration),
    ("awwwards.com", ResourceCategory::Inspiration),
    ("dribbble.com", ResourceCategory::Inspiration),
    ("motionsites.ai", ResourceCategory::Inspiration),
    // Animation
    ("animejs.com", ResourceCategory::Animation),
    ("motion.dev", ResourceCategory::Animation),
    ("gsap.com", ResourceCategory::Animation),
    // Icons
    ("hugeicons.com", ResourceCategory::Icons),
    ("xandemon.github.io", ResourceCategory::Icons),
    ("lucide.dev", ResourceCategory::Icons),
    // Developer tools and directories
    ("free-for.dev", ResourceCategory::Tools),
    ("star-history.com", ResourceCategory::Tools),
    ("github.com", ResourceCategory::Tools),
    ("getartcraft.com", ResourceCategory::Tools),
    ("claude-mods.com", ResourceCategory::Tools),
    ("digitalplat.org", ResourceCategory::Tools),
    ("play.google.com", ResourceCategory::Tools),
    // Cloud consoles and hosted services
    ("portal.azure.com", ResourceCategory::Cloud),
    ("cloud.mongodb.com", ResourceCategory::Cloud),
    ("cloud.oracle.com", ResourceCategory::Cloud),
    ("cloudinary.com", ResourceCategory::Cloud),
    ("clerk.com", ResourceCategory::Cloud),
    ("aws.amazon.com", ResourceCategory::Cloud),
    ("dash.cloudflare.com", ResourceCategory::Cloud),
    ("console.hetzner.com", ResourceCategory::Cloud),
    ("vercel.com", ResourceCategory::Cloud),
];

impl ResourceCategory {
    /// Classifies a link by its host, falling back to the bookmark folder it was filed in.
    pub fn classify(host: &str, folder_path: &[String]) -> Self {
        let host = host.trim_start_matches("www.");
        let rule = HOST_RULES
            .iter()
            .find(|(domain, _)| host == *domain || host.ends_with(&format!(".{domain}")));
        if let Some((_, category)) = rule {
            return *category;
        }
        if folder_path
            .iter()
            .any(|folder| folder.eq_ignore_ascii_case("components"))
        {
            return Self::UiComponents;
        }
        Self::Other
    }
}

/// A developer resource, ready to display.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Resource {
    /// Stable identity: host plus path, ignoring query, fragment and trailing slash.
    pub id: String,
    pub title: String,
    pub url: String,
    pub host: String,
    pub category: ResourceCategory,
    /// Folder the link was filed in, e.g. `develop/components`.
    pub folder: String,
    /// When the link was saved, as Unix milliseconds, if known.
    pub added_at: Option<i64>,
    pub origin: ResourceOrigin,
}

/// Where a resource lives: a browser bookmark, or a link saved directly in DevAtlas.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ResourceOrigin {
    Browser,
    DevAtlas,
}

impl Resource {
    /// Builds a resource from a raw bookmark, or `None` when its URL is unusable.
    pub fn from_bookmark(
        title: &str,
        raw_url: &str,
        folder_path: &[String],
        added_at: Option<i64>,
    ) -> Option<Self> {
        let url = normalize_url(raw_url)?;
        let host = url.host_str()?.trim_start_matches("www.").to_owned();
        let title = match title.trim() {
            "" => host.clone(),
            trimmed => trimmed.to_owned(),
        };
        Some(Self {
            id: format!("{host}{}", url.path().trim_end_matches('/')),
            title,
            category: ResourceCategory::classify(&host, folder_path),
            url: url.into(),
            host,
            folder: folder_path.join("/"),
            added_at,
            origin: ResourceOrigin::Browser,
        })
    }

    /// Builds a resource for a link saved in DevAtlas, or `None` when its URL is unusable.
    pub fn saved(title: &str, raw_url: &str, added_at: i64) -> Option<Self> {
        let resource = Self::from_bookmark(title, raw_url, &[], Some(added_at))?;
        Some(Self {
            origin: ResourceOrigin::DevAtlas,
            ..resource
        })
    }
}

/// Cleans a bookmarked URL: unwraps `openbookmark.page` redirects, drops embedded
/// credentials (some extensions save links as `https://newtab@host/…`), and rejects
/// anything that is not http(s), such as `javascript:` or `chrome://` links.
pub fn normalize_url(raw: &str) -> Option<Url> {
    let mut url = Url::parse(raw.trim()).ok()?;
    if url.host_str() == Some("openbookmark.page") {
        let target = url
            .query_pairs()
            .find(|(key, _)| key == "url")
            .map(|(_, value)| value.into_owned())?;
        url = Url::parse(&target).ok()?;
    }
    if !matches!(url.scheme(), "http" | "https") {
        return None;
    }
    url.set_username("").ok()?;
    url.set_password(None).ok()?;
    Some(url)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn folders(path: &[&str]) -> Vec<String> {
        path.iter().map(|folder| (*folder).to_owned()).collect()
    }

    #[test]
    fn normalize_strips_embedded_credentials() {
        let url = normalize_url("https://newtab@kokonutui.com/docs/cards/card-stack").unwrap();
        assert_eq!(url.as_str(), "https://kokonutui.com/docs/cards/card-stack");
    }

    #[test]
    fn normalize_unwraps_openbookmark_redirects() {
        let url = normalize_url(
            "https://newtab@openbookmark.page/r/?url=https%3A%2F%2Fplay.google.com%2Fconsole%2Fsignup",
        )
        .unwrap();
        assert_eq!(url.as_str(), "https://play.google.com/console/signup");
    }

    #[test]
    fn normalize_rejects_non_web_links() {
        assert_eq!(normalize_url("javascript:alert(1)"), None);
        assert_eq!(normalize_url("chrome://settings"), None);
        assert_eq!(normalize_url("not a url"), None);
    }

    #[test]
    fn classify_uses_known_hosts_including_subdomains_and_www() {
        assert_eq!(
            ResourceCategory::classify("reactbits.dev", &[]),
            ResourceCategory::UiComponents
        );
        assert_eq!(
            ResourceCategory::classify("ui.aceternity.com", &[]),
            ResourceCategory::UiComponents
        );
        assert_eq!(
            ResourceCategory::classify("www.mobbin.com", &[]),
            ResourceCategory::Inspiration
        );
        assert_eq!(
            ResourceCategory::classify("portal.azure.com", &[]),
            ResourceCategory::Cloud
        );
    }

    #[test]
    fn classify_does_not_match_lookalike_hosts() {
        assert_eq!(
            ResourceCategory::classify("notgithub.com", &[]),
            ResourceCategory::Other
        );
    }

    #[test]
    fn classify_falls_back_to_the_components_folder() {
        let in_components = folders(&["develop", "components"]);
        assert_eq!(
            ResourceCategory::classify("unknown.example", &in_components),
            ResourceCategory::UiComponents
        );
        assert_eq!(
            ResourceCategory::classify("unknown.example", &folders(&["develop"])),
            ResourceCategory::Other
        );
    }

    #[test]
    fn from_bookmark_builds_a_clean_resource() {
        let resource = Resource::from_bookmark(
            "  React Bits - Index ",
            "https://newtab@www.reactbits.dev/get-started/index/?ref=x#top",
            &folders(&["develop", "components"]),
            Some(1_700_000_000_000),
        )
        .unwrap();

        assert_eq!(resource.id, "reactbits.dev/get-started/index");
        assert_eq!(resource.title, "React Bits - Index");
        assert_eq!(resource.host, "reactbits.dev");
        assert_eq!(resource.category, ResourceCategory::UiComponents);
        assert_eq!(resource.folder, "develop/components");
        assert!(!resource.url.contains("newtab@"));
    }

    #[test]
    fn saved_links_are_classified_and_marked_as_devatlas() {
        let resource = Resource::saved(
            "Best Portfolio Websites",
            "https://www.awwwards.com/websites/portfolio/",
            7,
        )
        .unwrap();

        assert_eq!(resource.id, "awwwards.com/websites/portfolio");
        assert_eq!(resource.category, ResourceCategory::Inspiration);
        assert_eq!(resource.origin, ResourceOrigin::DevAtlas);
        assert_eq!(resource.added_at, Some(7));
        assert_eq!(resource.folder, "");
    }

    #[test]
    fn from_bookmark_falls_back_to_host_for_blank_titles() {
        let resource = Resource::from_bookmark("", "https://motion.dev/docs", &[], None).unwrap();
        assert_eq!(resource.title, "motion.dev");
    }

    #[test]
    fn serializes_categories_as_kebab_case() {
        let json = serde_json::to_string(&ResourceCategory::UiComponents).unwrap();
        assert_eq!(json, "\"ui-components\"");
    }
}
