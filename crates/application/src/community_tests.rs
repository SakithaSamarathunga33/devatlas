use std::collections::HashMap;
use std::convert::Infallible;
use std::pin::pin;
use std::sync::Mutex;
use std::task::{Context, Poll, Waker};

use devatlas_domain::resource::Resource;

use super::*;

const SHARED: &str = "0b8f4a9e-6d2c-4b1a-9f3e-2c7d5e8a1b40";
const OTHER: &str = "11111111-2222-4333-8444-555555555555";

fn block_on<F: Future>(future: F) -> F::Output {
    let mut future = pin!(future);
    let mut cx = Context::from_waker(Waker::noop());
    loop {
        if let Poll::Ready(output) = future.as_mut().poll(&mut cx) {
            return output;
        }
    }
}

fn item(title: &str, url: &str) -> LibraryItem {
    LibraryItem {
        resource: Resource::saved(title, url, 0).unwrap(),
        is_new: false,
        category_override: None,
        status: None,
        tags: vec!["private-tag".to_owned()],
        note: Some("my private note".to_owned()),
        last_opened_at: None,
        link_health: None,
    }
}

fn group(ids: &[&str]) -> Group {
    Group {
        id: "local-1".to_owned(),
        name: "  Rust tools ".to_owned(),
        description: Some("Crates I like".to_owned()),
        resource_ids: ids.iter().map(|&id| id.to_owned()).collect(),
        created_at: 0,
    }
}

/// Records publishes; answers `NotYours` for ids in `foreign`.
#[derive(Default)]
struct FakeSource {
    published: Mutex<Vec<PublishRequest>>,
    unpublished: Mutex<Vec<String>>,
    foreign: Vec<String>,
    filters: Mutex<Vec<CollectionFilter>>,
    pages: Vec<SharedPage>,
    detail: Option<SharedCollection>,
    /// Follows (`true`) and unfollows sent, in order.
    follows: Mutex<Vec<(String, bool)>>,
    /// The caller's own collections: following them is refused.
    own: Vec<String>,
    following: Option<bool>,
    followers: u32,
}

impl CommunitySource for FakeSource {
    type Error = Infallible;

    async fn collections(&self, filter: &CollectionFilter) -> Result<SharedPage, Infallible> {
        let mut filters = self.filters.lock().unwrap();
        filters.push(filter.clone());
        Ok(self
            .pages
            .get(filters.len() - 1)
            .cloned()
            .unwrap_or(SharedPage {
                collections: Vec::new(),
                next_offset: None,
            }))
    }

    async fn collection(&self, _id: &str) -> Result<Option<SharedCollection>, Infallible> {
        Ok(self.detail.clone())
    }

    async fn publish(&self, request: &PublishRequest) -> Result<PublishOutcome, Infallible> {
        self.published.lock().unwrap().push(request.clone());
        Ok(match &request.collection {
            Some(id) if self.foreign.contains(id) => PublishOutcome::NotYours,
            Some(id) => PublishOutcome::Published(id.clone()),
            None => PublishOutcome::Published(SHARED.to_uppercase()),
        })
    }

    async fn unpublish(&self, id: &str) -> Result<(), Infallible> {
        self.unpublished.lock().unwrap().push(id.to_owned());
        Ok(())
    }

    async fn report(&self, _id: &str, reason: Option<&str>) -> Result<bool, Infallible> {
        Ok(reason != Some("again"))
    }

    async fn follow(&self, id: &str) -> Result<bool, Infallible> {
        self.follows.lock().unwrap().push((id.to_owned(), true));
        Ok(!self.own.iter().any(|own| own == id))
    }

    async fn unfollow(&self, id: &str) -> Result<(), Infallible> {
        self.follows.lock().unwrap().push((id.to_owned(), false));
        Ok(())
    }

    async fn is_following(&self, _id: &str) -> Result<Option<bool>, Infallible> {
        Ok(self.following)
    }

    async fn follower_count(&self, _id: &str) -> Result<Option<u32>, Infallible> {
        Ok(Some(self.followers))
    }
}

#[derive(Default)]
struct FakeShares(Mutex<HashMap<String, String>>);

impl ShareStore for FakeShares {
    type Error = Infallible;

    fn load(&self) -> Result<HashMap<String, String>, Infallible> {
        Ok(self.0.lock().unwrap().clone())
    }

    fn save(&self, shares: &HashMap<String, String>) -> Result<(), Infallible> {
        *self.0.lock().unwrap() = shares.clone();
        Ok(())
    }
}

fn library() -> Vec<LibraryItem> {
    vec![
        item("Serde", "https://serde.rs/"),
        item("Old site", "http://example.com/plain"),
        item("Not in group", "https://tokio.rs/"),
        item("  ", "https://www.docs.rs/crate"),
    ]
}

#[test]
fn recognises_uuids() {
    assert!(is_uuid(SHARED));
    assert!(is_uuid(&SHARED.to_uppercase()));
    for bad in [
        "",
        "not-a-uuid",
        "0b8f4a9e6d2c4b1a9f3e2c7d5e8a1b40",
        &format!("{SHARED}0"),
    ] {
        assert!(!is_uuid(bad), "{bad}");
    }
    assert!(!is_uuid("0b8f4a9e-6d2c-4b1a-9f3e-2c7d5e8a1b4g"));
}

#[test]
fn preview_keeps_https_links_and_counts_the_rest() {
    let preview = share_preview(
        &group(&["serde.rs", "example.com/plain", "docs.rs/crate", "gone.dev"]),
        &library(),
        None,
    );

    assert_eq!(preview.title, "Rust tools");
    assert_eq!(preview.description.as_deref(), Some("Crates I like"));
    assert_eq!(preview.skipped, 1);
    let hosts: Vec<_> = preview
        .links
        .iter()
        .map(|link| link.host.as_str())
        .collect();
    assert_eq!(hosts, ["serde.rs", "docs.rs"]);
    // A blank title falls back to the host.
    assert_eq!(preview.links[1].title, "docs.rs");
}

#[test]
fn publishing_sends_only_titles_and_urls_and_remembers_the_copy() {
    let source = FakeSource::default();
    let shares = FakeShares::default();

    let id = block_on(share_group(
        &source,
        &shares,
        &group(&["serde.rs", "example.com/plain"]),
        &library(),
    ))
    .unwrap();

    assert_eq!(id, SHARED);
    let sent = source.published.lock().unwrap()[0].clone();
    assert_eq!(sent.collection, None);
    assert_eq!(
        sent.links,
        [PublishLink {
            url: "https://serde.rs/".to_owned(),
            title: "Serde".to_owned(),
        }]
    );
    let body = serde_json::to_string(&sent).unwrap();
    assert!(!body.contains("private"), "{body}");
    assert_eq!(
        shares.load().unwrap().get("local-1").map(String::as_str),
        Some(SHARED)
    );
}

#[test]
fn sharing_again_updates_the_same_collection() {
    let source = FakeSource::default();
    let shares = FakeShares::default();
    shares
        .save(&HashMap::from([("local-1".to_owned(), OTHER.to_owned())]))
        .unwrap();

    let id = block_on(share_group(
        &source,
        &shares,
        &group(&["serde.rs"]),
        &library(),
    ))
    .unwrap();

    assert_eq!(id, OTHER);
    let published = source.published.lock().unwrap();
    assert_eq!(published.len(), 1);
    assert_eq!(published[0].collection.as_deref(), Some(OTHER));
}

#[test]
fn a_copy_that_is_no_longer_ours_is_published_anew() {
    let source = FakeSource {
        foreign: vec![OTHER.to_owned()],
        ..FakeSource::default()
    };
    let shares = FakeShares::default();
    shares
        .save(&HashMap::from([("local-1".to_owned(), OTHER.to_owned())]))
        .unwrap();

    let id = block_on(share_group(
        &source,
        &shares,
        &group(&["serde.rs"]),
        &library(),
    ))
    .unwrap();

    assert_eq!(id, SHARED);
    let published = source.published.lock().unwrap();
    assert_eq!(published.len(), 2);
    assert_eq!(published[1].collection, None);
    assert_eq!(shares.load().unwrap()["local-1"], SHARED);
}

#[test]
fn refuses_empty_and_oversized_collections_before_sending() {
    let source = FakeSource::default();
    let shares = FakeShares::default();
    let result = block_on(share_group(
        &source,
        &shares,
        &group(&["example.com/plain"]),
        &library(),
    ));
    assert!(matches!(
        result,
        Err(CommunityError::Invalid(CommunityInputError::NoLinks))
    ));

    let many: Vec<LibraryItem> = (0..=MAX_LINKS)
        .map(|n| item("Link", &format!("https://site{n}.dev/")))
        .collect();
    let ids: Vec<String> = many.iter().map(|item| item.resource.id.clone()).collect();
    let big = Group {
        resource_ids: ids,
        ..group(&[])
    };
    let result = block_on(share_group(&source, &shares, &big, &many));
    assert!(matches!(
        result,
        Err(CommunityError::Invalid(CommunityInputError::TooManyLinks(
            201
        )))
    ));

    let unnamed = Group {
        name: "   ".to_owned(),
        ..group(&["serde.rs"])
    };
    let result = block_on(share_group(&source, &shares, &unnamed, &library()));
    assert!(matches!(
        result,
        Err(CommunityError::Invalid(CommunityInputError::TitleRequired))
    ));
    assert!(source.published.lock().unwrap().is_empty());
}

#[test]
fn unsharing_forgets_every_local_collection_mapped_to_it() {
    let source = FakeSource::default();
    let shares = FakeShares::default();
    shares
        .save(&HashMap::from([
            ("a".to_owned(), SHARED.to_owned()),
            ("b".to_owned(), OTHER.to_owned()),
        ]))
        .unwrap();

    block_on(unshare(&source, &shares, &SHARED.to_uppercase())).unwrap();

    assert_eq!(*source.unpublished.lock().unwrap(), [SHARED]);
    assert_eq!(
        shares.load().unwrap(),
        HashMap::from([("b".to_owned(), OTHER.to_owned())])
    );
    assert!(matches!(
        block_on(unshare(&source, &shares, "../x")),
        Err(CommunityError::Invalid(CommunityInputError::InvalidId))
    ));
}

#[test]
fn browsing_cleans_the_query_and_bounds_the_offset() {
    let source = FakeSource::default();

    block_on(browse(&source, Some("  rust\u{0}  async "), 60)).unwrap();
    block_on(browse(&source, Some("   "), 30)).unwrap();
    let beyond = block_on(browse(&source, None, MAX_OFFSET + 1)).unwrap();

    let filters = source.filters.lock().unwrap();
    assert_eq!(filters.len(), 2, "nothing is asked past the last page");
    assert_eq!(beyond.next_offset, None);
    assert_eq!(filters[0].query.as_deref(), Some("rust async"));
    assert_eq!(filters[0].offset, 60);
    assert_eq!(filters[1].query, None);
    assert_eq!(filters[1].owner_id, None);
}

#[test]
fn reads_every_page_of_an_accounts_collections() {
    let summary = |n: u32| SharedSummary {
        id: SHARED.to_owned(),
        title: format!("C{n}"),
        description: None,
        link_count: 1,
        updated_at: "2026-11-14T10:00:00+00:00".to_owned(),
        owner: Owner {
            id: OTHER.to_owned(),
            username: "octocat".to_owned(),
            avatar_url: None,
        },
        follower_count: 0,
    };
    let source = FakeSource {
        pages: vec![
            SharedPage {
                collections: vec![summary(1)],
                next_offset: Some(30),
            },
            SharedPage {
                collections: vec![summary(2)],
                next_offset: None,
            },
        ],
        ..FakeSource::default()
    };

    let mine = block_on(my_collections(&source, OTHER)).unwrap();

    assert_eq!(mine.len(), 2);
    let filters = source.filters.lock().unwrap();
    assert_eq!(filters[1].offset, 30);
    assert_eq!(filters[1].owner_id.as_deref(), Some(OTHER));
}

#[test]
fn reports_trim_the_reason_and_refuse_long_ones() {
    let source = FakeSource::default();
    assert!(block_on(report(&source, SHARED, Some("  spam  "))).unwrap());
    assert!(!block_on(report(&source, SHARED, Some("again"))).unwrap());
    assert!(matches!(
        block_on(report(
            &source,
            SHARED,
            Some(&"x".repeat(MAX_REASON_CHARS + 1))
        )),
        Err(CommunityError::Invalid(CommunityInputError::ReasonTooLong))
    ));
}

#[test]
fn untrusted_links_must_be_https_and_get_bounded_titles() {
    assert!(untrusted_link("http://example.com/", "x").is_none());
    assert!(untrusted_link("javascript:alert(1)", "x").is_none());
    assert!(untrusted_link(&format!("https://a.dev/{}", "p".repeat(MAX_URL_LEN)), "x").is_none());

    let link = untrusted_link("https://www.Example.com/Docs/", &"t\u{202e}".repeat(400)).unwrap();
    assert_eq!(link.host, "example.com");
    assert_eq!(link.library_id, "example.com/Docs");
    assert_eq!(link.title.chars().count(), MAX_LINK_TITLE_CHARS);
    assert!(!link.title.contains('\u{202e}'));
}

#[test]
fn untrusted_summaries_are_checked_and_bounded() {
    let raw = UntrustedSummary {
        id: SHARED,
        title: "  Hello\nworld ",
        description: Some(""),
        link_count: 9_999,
        updated_at: "2026-11-14T10:00:00.123+00:00",
        owner_id: OTHER,
        username: "octocat",
        avatar_url: Some("https://tracker.example/pixel.gif"),
        follower_count: 12,
    };
    let summary = untrusted_summary(&raw).unwrap();
    assert_eq!(summary.follower_count, 12);
    assert_eq!(summary.title, "Hello world");
    assert_eq!(summary.description, None);
    assert_eq!(summary.link_count, 200);
    assert_eq!(summary.owner.avatar_url, None);

    assert!(untrusted_summary(&UntrustedSummary { id: "x", ..raw }).is_none());
    assert!(
        untrusted_summary(&UntrustedSummary {
            updated_at: "<script>",
            ..raw
        })
        .is_none()
    );
    assert!(untrusted_summary(&UntrustedSummary { title: " ", ..raw }).is_none());
    assert!(
        untrusted_summary(&UntrustedSummary {
            follower_count: -1,
            ..raw
        })
        .is_none()
    );
}

#[test]
fn follower_counts_must_be_non_negative_integers_that_fit() {
    assert_eq!(follower_count(0), Some(0));
    assert_eq!(follower_count(13), Some(13));
    assert_eq!(follower_count(-1), None);
    assert_eq!(follower_count(i64::MAX), None);
}

fn detail() -> SharedCollection {
    SharedCollection {
        summary: SharedSummary {
            id: SHARED.to_owned(),
            title: "Rust".to_owned(),
            description: None,
            link_count: 0,
            updated_at: "2026-11-14T10:00:00+00:00".to_owned(),
            owner: Owner {
                id: OTHER.to_owned(),
                username: "octocat".to_owned(),
                avatar_url: None,
            },
            follower_count: 4,
        },
        links: Vec::new(),
        is_following: None,
    }
}

#[test]
fn a_collection_says_whether_the_account_follows_it() {
    let signed_in = FakeSource {
        detail: Some(detail()),
        following: Some(true),
        ..FakeSource::default()
    };
    let shown = block_on(collection(&signed_in, SHARED)).unwrap();
    assert_eq!(shown.is_following, Some(true));
    assert_eq!(shown.summary.follower_count, 4);

    let signed_out = FakeSource {
        detail: Some(detail()),
        ..FakeSource::default()
    };
    assert_eq!(
        block_on(collection(&signed_out, SHARED))
            .unwrap()
            .is_following,
        None
    );
}

#[test]
fn following_sends_the_id_and_reads_back_the_count() {
    let source = FakeSource {
        followers: 13,
        ..FakeSource::default()
    };

    let followed = block_on(set_following(&source, &SHARED.to_uppercase(), true)).unwrap();
    let unfollowed = block_on(set_following(&source, SHARED, false)).unwrap();

    assert_eq!(
        followed,
        FollowState {
            following: true,
            follower_count: 13
        }
    );
    assert!(!unfollowed.following);
    assert_eq!(
        *source.follows.lock().unwrap(),
        [(SHARED.to_owned(), true), (SHARED.to_owned(), false)]
    );
}

#[test]
fn following_your_own_collection_is_refused_with_a_clear_message() {
    let source = FakeSource {
        own: vec![SHARED.to_owned()],
        ..FakeSource::default()
    };

    let error = block_on(set_following(&source, SHARED, true)).unwrap_err();

    assert!(matches!(
        error,
        CommunityError::Invalid(CommunityInputError::OwnCollection)
    ));
    assert_eq!(error.to_string(), "You can't follow your own collection.");
}

#[test]
fn following_a_malformed_id_sends_nothing() {
    let source = FakeSource::default();
    assert!(matches!(
        block_on(set_following(&source, "../x", true)),
        Err(CommunityError::Invalid(CommunityInputError::InvalidId))
    ));
    assert!(source.follows.lock().unwrap().is_empty());
}

#[test]
fn avatars_come_only_from_github() {
    assert_eq!(
        avatar_url("https://avatars.githubusercontent.com/u/1?v=4").as_deref(),
        Some("https://avatars.githubusercontent.com/u/1?v=4")
    );
    for bad in [
        "http://avatars.githubusercontent.com/u/1",
        "https://avatars.githubusercontent.com.evil.example/u/1",
        "https://tracker.example/pixel.gif",
    ] {
        assert_eq!(avatar_url(bad), None, "{bad}");
    }
}
