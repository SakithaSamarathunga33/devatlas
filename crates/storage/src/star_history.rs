//! Reads star-history.com's rankings. The site has no API for them: they are constants in
//! its JavaScript bundle, whose hashed name appears on the home page. The bundle is only read
//! as text, never run, and goes through the news reader's bounded, https-only client.
//! Cached for six hours, since the site rebuilds at most daily.

use std::time::{Duration, Instant};

use devatlas_application::star_history::{StarBoardSource, StarBoards, StarRepo, StarTier};
use serde::Deserialize;

use crate::news::{NewsError, NewsReader, lock};

const HOME_URL: &str = "https://www.star-history.com/";
const ASSETS_URL: &str = "https://www.star-history.com/assets/";
const BOARD_CACHE_FOR: Duration = Duration::from_secs(6 * 60 * 60);
/// How far before a list its date constants can sit in the bundle.
const DATE_WINDOW: usize = 64;
/// Longest object literal read; real ones are under 200 bytes. Keeps scanning linear.
const MAX_LITERAL_LEN: usize = 256;
const MAX_SAFE_INTEGER: u64 = (1 << 53) - 1;

impl StarBoardSource for NewsReader {
    type Error = NewsError;

    async fn boards(&self) -> Result<StarBoards, NewsError> {
        let cached = lock(&self.star_boards)
            .as_ref()
            .filter(|(fetched_at, _)| fetched_at.elapsed() < BOARD_CACHE_FOR)
            .map(|(_, boards)| boards.clone());
        if let Some(boards) = cached {
            return Ok(boards);
        }

        let boards = self.read_boards().await.inspect_err(|error| {
            tracing::warn!(%error, "star-history rankings unavailable");
        })?;
        *lock(&self.star_boards) = Some((Instant::now(), boards.clone()));
        Ok(boards)
    }
}

impl NewsReader {
    async fn read_boards(&self) -> Result<StarBoards, NewsError> {
        let home = self.get(HOME_URL, "text/html").await?;
        let home = String::from_utf8_lossy(&home);
        let file = bundle_file(&home).ok_or(NewsError::Unrecognized)?;
        let bundle = self
            .get(&format!("{ASSETS_URL}{file}"), "text/javascript, */*")
            .await?;
        parse_bundle(&String::from_utf8_lossy(&bundle)).ok_or(NewsError::Unrecognized)
    }
}

/// The bundle's file name on the home page. Only plain names are accepted, so the address
/// built from it cannot leave the site's assets folder.
fn bundle_file(html: &str) -> Option<&str> {
    const PREFIX: &str = "src=\"/assets/";
    let rest = &html[html.find("src=\"/assets/index-")? + PREFIX.len()..];
    let file = &rest[..rest.find('"')?];
    let plain = |c: char| c.is_ascii_alphanumeric() || matches!(c, '-' | '_');
    file.strip_suffix(".js")?.chars().all(plain).then_some(file)
}

/// `None` when the all-time list is missing, the sign that the bundle changed shape. Weekly
/// can legitimately be empty; a missing pool or pyramid only empties that tab.
fn parse_bundle(js: &str) -> Option<StarBoards> {
    let (weekly, all_time): (Vec<_>, Vec<_>) = literals(js, "{name:\"")
        .filter_map(|(at, literal)| Some((at, star_repo(literal)?)))
        .partition(|(_, repo)| repo.new_stars.is_some());
    let tiers: Vec<_> = literals(js, "{threshold:")
        .filter_map(|(at, literal)| Some((at, star_tier(literal)?)))
        .collect();

    let all_time_updated = dates_before(js, all_time.first()?.0).pop();
    let week = weekly.first().map(|(at, _)| dates_before(js, *at));
    Some(StarBoards {
        weekly_period: week
            .filter(|dates| !dates.is_empty())
            .map(|d| d.join(" – ")),
        all_time_updated,
        pyramid_updated: tiers
            .first()
            .and_then(|(at, _)| dates_before(js, *at).pop()),
        weekly: weekly.into_iter().map(|(_, repo)| repo).collect(),
        all_time: all_time.into_iter().map(|(_, repo)| repo).collect(),
        random_pool: random_pool(js).unwrap_or_default(),
        pyramid: tiers.into_iter().map(|(_, tier)| tier).collect(),
    })
}

/// Each object literal starting with `opening`: its position and its text inside the braces.
fn literals<'a>(js: &'a str, opening: &'a str) -> impl Iterator<Item = (usize, &'a str)> {
    js.match_indices(opening).filter_map(|(at, _)| {
        let body = js.get(at + 1..)?;
        let end = body
            .bytes()
            .take(MAX_LITERAL_LEN)
            .position(|byte| byte == b'}')?;
        Some((at, &body[..end]))
    })
}

/// A field's raw value. Repository names and labels contain no commas.
fn field<'a>(literal: &'a str, key: &str) -> Option<&'a str> {
    literal
        .split(',')
        .find_map(|part| part.strip_prefix(key)?.strip_prefix(':'))
}

fn text(value: &str) -> Option<String> {
    Some(value.strip_prefix('"')?.strip_suffix('"')?.to_owned())
}

/// An integer as the minifier writes it: `561535` or `5e5`. Larger than JavaScript can hold
/// exactly is refused, so one bad entry can't fail the UI's validation of the whole payload.
fn number(value: &str) -> Option<u64> {
    let parsed = match value.split_once('e') {
        Some((digits, power)) => digits
            .parse::<u64>()
            .ok()?
            .checked_mul(10_u64.checked_pow(power.parse().ok()?)?),
        None => value.parse().ok(),
    };
    parsed.filter(|number| *number <= MAX_SAFE_INTEGER)
}

fn star_repo(literal: &str) -> Option<StarRepo> {
    Some(StarRepo {
        full_name: text(field(literal, "name")?)?,
        stars: number(field(literal, "stars_total")?)?,
        new_stars: field(literal, "new_stars").and_then(number),
        rank_change: field(literal, "rank_change").and_then(|value| value.parse().ok()),
    })
}

fn star_tier(literal: &str) -> Option<StarTier> {
    Some(StarTier {
        threshold: number(field(literal, "threshold")?)?,
        label: text(field(literal, "label")?)?,
        count: number(field(literal, "count")?)?,
    })
}

/// The "Nov 3, 2026" constants the bundler places just before a list.
fn dates_before(js: &str, at: usize) -> Vec<String> {
    let start = (at.saturating_sub(DATE_WINDOW)..at).find(|&index| js.is_char_boundary(index));
    start
        .and_then(|start| js.get(start..at))
        .unwrap_or_default()
        .split('"')
        .filter(|part| is_date(part))
        .map(str::to_owned)
        .collect()
}

fn is_date(text: &str) -> bool {
    text.len() <= 16
        && text.split_once(", ").is_some_and(|(_, year)| {
            year.len() == 4 && year.bytes().all(|byte| byte.is_ascii_digit())
        })
}

#[derive(Deserialize)]
struct PoolRepo {
    name: String,
    stars_total: u64,
}

/// The large list the Random tab draws from, embedded as `JSON.parse('[…]')`.
fn random_pool(js: &str) -> Option<Vec<StarRepo>> {
    const CALL: &str = "JSON.parse('";
    let rest = &js[js.find("JSON.parse('[{\"name\":\"")? + CALL.len()..];
    let rows: Vec<PoolRepo> = serde_json::from_str(&rest[..rest.find("')")?]).ok()?;
    Some(
        rows.into_iter()
            .map(|row| StarRepo {
                full_name: row.name,
                stars: row.stars_total,
                new_stars: None,
                rank_change: None,
            })
            .collect(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The shape of the site's minified bundle, including its exponent notation for numbers.
    const BUNDLE: &str = concat!(
        r#"var a=1,uv="Nov 10, 2026",kv=[{name:"code/build-x",stars_total:561535,rank_change:0},"#,
        r#"{name:"round/repo",stars_total:5e5,rank_change:0}],dv={updated_at:uv,repos:kv},"#,
        r#"pv="Nov 3, 2026",hv="Nov 9, 2026",fv=[{name:"morluto/rea",new_stars:24468,"#,
        r#"stars_total:449223,rank_change:5},{name:"new/entry",new_stars:7200,stars_total:9000,"#,
        r#"rank_change:null},{name:"down/repo",new_stars:5000,stars_total:6000,rank_change:-2}],"#,
        r#"_v={from:pv,to:hv,repos:fv},gv="Nov 10, 2026",yv=[{threshold:1e5,label:"100K+","#,
        r#"count:141},{threshold:1,label:"1+",count:33109894}],bv={updated_at:gv,tiers:yv},"#,
        r#"Cs=JSON.parse('[{"name":"pool/one","stars_total":12,"rank":1}]'),other={name:"x"};"#,
    );

    #[test]
    fn finds_the_bundle_named_by_the_home_page() {
        let html = r#"<script type="module" src="/assets/index-BM4fLvLn.js"></script>"#;

        assert_eq!(bundle_file(html), Some("index-BM4fLvLn.js"));
    }

    #[test]
    fn refuses_a_bundle_path_that_could_leave_the_assets_folder() {
        let html = r#"<script src="/assets/index-../../evil.js"></script>"#;

        assert_eq!(bundle_file(html), None);
        assert_eq!(bundle_file("<html></html>"), None);
    }

    #[test]
    fn reads_the_weekly_ranking_with_movement() {
        let boards = parse_bundle(BUNDLE).unwrap();

        let names: Vec<&str> = boards.weekly.iter().map(|r| r.full_name.as_str()).collect();
        assert_eq!(names, ["morluto/rea", "new/entry", "down/repo"]);
        assert_eq!(boards.weekly[0].new_stars, Some(24_468));
        assert_eq!(boards.weekly[0].stars, 449_223);
        assert_eq!(boards.weekly[0].rank_change, Some(5));
        assert_eq!(boards.weekly[1].rank_change, None);
        assert_eq!(boards.weekly[2].rank_change, Some(-2));
        assert_eq!(
            boards.weekly_period.as_deref(),
            Some("Nov 3, 2026 – Nov 9, 2026")
        );
    }

    #[test]
    fn reads_all_time_stars_written_in_exponent_notation() {
        let boards = parse_bundle(BUNDLE).unwrap();

        assert_eq!(boards.all_time.len(), 2);
        assert_eq!(boards.all_time[0].new_stars, None);
        assert_eq!(boards.all_time[1].stars, 500_000);
        assert_eq!(boards.all_time_updated.as_deref(), Some("Nov 10, 2026"));
    }

    #[test]
    fn reads_the_random_pool_and_the_pyramid() {
        let boards = parse_bundle(BUNDLE).unwrap();

        assert_eq!(boards.random_pool.len(), 1);
        assert_eq!(boards.random_pool[0].full_name, "pool/one");
        assert_eq!(boards.random_pool[0].stars, 12);
        assert_eq!(boards.pyramid.len(), 2);
        assert_eq!(boards.pyramid[0].threshold, 100_000);
        assert_eq!(boards.pyramid[0].label, "100K+");
        assert_eq!(boards.pyramid[1].count, 33_109_894);
        assert_eq!(boards.pyramid_updated.as_deref(), Some("Nov 10, 2026"));
    }

    #[test]
    fn drops_numbers_the_ui_cannot_represent_exactly() {
        assert_eq!(number("9007199254740991"), Some(9_007_199_254_740_991));
        assert_eq!(number("9007199254740992"), None);
        assert_eq!(number("5e18"), None);
    }

    #[test]
    fn ignores_a_literal_that_never_closes_nearby() {
        let unclosed = format!("{{name:\"a/b\",stars_total:1{}}}", " ".repeat(1_000));

        assert_eq!(literals(&unclosed, "{name:\"").count(), 0);
    }

    #[test]
    fn a_bundle_without_the_rankings_is_not_recognized() {
        assert_eq!(parse_bundle("var a={name:\"x\"};"), None);
    }
}
