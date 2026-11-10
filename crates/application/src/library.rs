//! Use case: build the developer library from a bookmark source.

use std::collections::HashSet;

use devatlas_domain::resource::Resource;
use serde::Serialize;

/// A bookmark as a browser stores it, before cleaning or classification.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RawBookmark {
    pub title: String,
    pub url: String,
    /// Folders from the top level down, excluding the browser's root (e.g. "Bookmarks bar").
    pub folder_path: Vec<String>,
    /// Unix milliseconds, if the browser recorded it.
    pub added_at: Option<i64>,
}

/// Port: a place bookmarks can be read from, such as a browser profile.
pub trait BookmarkSource {
    type Error: std::error::Error;

    fn bookmarks(&self) -> Result<Vec<RawBookmark>, Self::Error>;
}

/// Where the library was read from, shown to the user.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LibrarySource {
    pub browser: String,
    pub folder: String,
}

/// The developer library as currently found in the source.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LibrarySnapshot {
    pub source: LibrarySource,
    pub resources: Vec<Resource>,
}

/// Collects the bookmarks filed under the top-level `folder` (any depth, matched
/// case-insensitively), cleans and classifies them, drops duplicates and unusable links,
/// and sorts them by title.
pub fn load_library<S: BookmarkSource>(
    source: &S,
    browser: &str,
    folder: &str,
) -> Result<LibrarySnapshot, S::Error> {
    let mut seen = HashSet::new();
    let mut resources: Vec<Resource> = source
        .bookmarks()?
        .into_iter()
        .filter(|bookmark| {
            bookmark
                .folder_path
                .first()
                .is_some_and(|top| top.eq_ignore_ascii_case(folder))
        })
        .filter_map(|bookmark| {
            Resource::from_bookmark(
                &bookmark.title,
                &bookmark.url,
                &bookmark.folder_path,
                bookmark.added_at,
            )
        })
        .filter(|resource| seen.insert(resource.id.clone()))
        .collect();
    resources.sort_by_key(|resource| resource.title.to_lowercase());

    Ok(LibrarySnapshot {
        source: LibrarySource {
            browser: browser.to_owned(),
            folder: folder.to_owned(),
        },
        resources,
    })
}

#[cfg(test)]
mod tests {
    use std::convert::Infallible;

    use devatlas_domain::resource::ResourceCategory;

    use super::*;

    struct FakeSource(Vec<RawBookmark>);

    impl BookmarkSource for FakeSource {
        type Error = Infallible;

        fn bookmarks(&self) -> Result<Vec<RawBookmark>, Infallible> {
            Ok(self.0.clone())
        }
    }

    fn bookmark(title: &str, url: &str, path: &[&str]) -> RawBookmark {
        RawBookmark {
            title: title.to_owned(),
            url: url.to_owned(),
            folder_path: path.iter().map(|folder| (*folder).to_owned()).collect(),
            added_at: None,
        }
    }

    #[test]
    fn keeps_only_the_requested_folder_and_its_subfolders() {
        let source = FakeSource(vec![
            bookmark("Motion", "https://motion.dev/docs", &["develop"]),
            bookmark(
                "Uiverse",
                "https://uiverse.io/elements",
                &["Develop", "components"],
            ),
            bookmark("Bank", "https://bank.example/login", &["stuffs"]),
            bookmark("Loose", "https://loose.example", &[]),
        ]);

        let library = load_library(&source, "Brave", "develop").unwrap();

        let titles: Vec<&str> = library.resources.iter().map(|r| r.title.as_str()).collect();
        assert_eq!(titles, ["Motion", "Uiverse"]);
        assert_eq!(
            library.resources[1].category,
            ResourceCategory::UiComponents
        );
        assert_eq!(
            library.source,
            LibrarySource {
                browser: "Brave".to_owned(),
                folder: "develop".to_owned(),
            }
        );
    }

    #[test]
    fn drops_duplicates_and_unusable_links_and_sorts_by_title() {
        let source = FakeSource(vec![
            bookmark("free-for.dev", "https://free-for.dev/?a=1#/", &["develop"]),
            bookmark(
                "Anime.js",
                "https://animejs.com/",
                &["develop", "components"],
            ),
            bookmark(
                "Free for Developers",
                "https://free-for.dev/#/",
                &["develop"],
            ),
            bookmark("Anime.js again", "https://animejs.com", &["develop"]),
            bookmark("Script", "javascript:void(0)", &["develop"]),
        ]);

        let library = load_library(&source, "Brave", "develop").unwrap();

        let titles: Vec<&str> = library.resources.iter().map(|r| r.title.as_str()).collect();
        assert_eq!(titles, ["Anime.js", "free-for.dev"]);
    }
}
