//! Reads the monthly language-popularity indexes: TIOBE's published top-20 table and PYPL's
//! data file. Both go through the news reader's bounded, https-only client and are cached
//! for six hours, since they change once a month.

use std::time::{Duration, Instant};

use devatlas_application::rankings::{LanguageRank, LanguageRanking, RankingIndex, RankingSource};
use scraper::{Html, Selector};

use crate::news::{NewsError, NewsReader, lock};

const TIOBE_URL: &str = "https://www.tiobe.com/tiobe-index/";
const PYPL_DATA_URL: &str = "https://pypl.github.io/PYPL/All.js";
const RANKING_CACHE_FOR: Duration = Duration::from_secs(6 * 60 * 60);
const MONTHS: [&str; 12] = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

impl RankingSource for NewsReader {
    type Error = NewsError;

    async fn ranking(&self, index: RankingIndex) -> Result<LanguageRanking, NewsError> {
        let cached = lock(&self.rankings)
            .get(&index)
            .filter(|(fetched_at, _)| fetched_at.elapsed() < RANKING_CACHE_FOR)
            .map(|(_, ranking)| ranking.clone());
        if let Some(ranking) = cached {
            return Ok(ranking);
        }

        let result = match index {
            RankingIndex::Tiobe => self.get(TIOBE_URL, "text/html").await.and_then(|body| {
                parse_tiobe(&String::from_utf8_lossy(&body)).ok_or(NewsError::Unrecognized)
            }),
            RankingIndex::Pypl => self
                .get(PYPL_DATA_URL, "application/javascript, text/plain")
                .await
                .and_then(|body| {
                    parse_pypl(&String::from_utf8_lossy(&body)).ok_or(NewsError::Unrecognized)
                }),
        };
        match result {
            Ok(ranking) => {
                lock(&self.rankings).insert(index, (Instant::now(), ranking.clone()));
                Ok(ranking)
            }
            Err(error) => {
                tracing::warn!(%error, ?index, "language ranking unavailable");
                Err(error)
            }
        }
    }
}

fn percent(text: &str) -> Option<f64> {
    text.trim().trim_end_matches('%').trim().parse().ok()
}

/// The `table#top20` rows of TIOBE's index page: this year's rank, last year's rank, an
/// arrow, the logo, the language, its rating and the change in percentage points.
fn parse_tiobe(html: &str) -> Option<LanguageRanking> {
    let document = Html::parse_document(html);
    let rows = Selector::parse("table#top20 tbody tr").ok()?;
    let cells = Selector::parse("td").ok()?;
    let languages: Vec<LanguageRank> = document
        .select(&rows)
        .filter_map(|row| {
            let text: Vec<String> = row
                .select(&cells)
                .map(|cell| cell.text().collect::<String>().trim().to_owned())
                .collect();
            Some(LanguageRank {
                rank: text.first()?.parse().ok()?,
                previous_rank: text.get(1)?.parse().ok(),
                language: text.get(4)?.clone(),
                share: percent(text.get(5)?)?,
                change: text.get(6).and_then(|change| percent(change)),
            })
        })
        .collect();
    if languages.is_empty() {
        return None;
    }
    Some(LanguageRanking {
        index: RankingIndex::Tiobe,
        period: tiobe_period(html)?,
        source_url: RankingIndex::Tiobe.home(),
        languages,
    })
}

/// "November 2026" from the page's "TIOBE Index for November 2026" heading.
fn tiobe_period(html: &str) -> Option<String> {
    const MARKER: &str = "TIOBE Index for ";
    let rest = &html[html.find(MARKER)? + MARKER.len()..];
    let end = rest.find(|c: char| !(c.is_ascii_alphanumeric() || c == ' '))?;
    let period = rest[..end].trim();
    (!period.is_empty() && period.len() <= 20).then(|| period.to_owned())
}

/// PYPL's `All.js`: a list of language names, then one row per month of shares (0–1) in the
/// same order. Ranks and yearly changes come from the newest row and the row a year earlier.
fn parse_pypl(js: &str) -> Option<LanguageRanking> {
    let start = js.find("// begin section languages")?;
    let end = start + js[start..].find("// end section languages")?;
    let names: Vec<&str> = js[start..end].split('\'').skip(1).step_by(2).collect();
    if names.is_empty() {
        return None;
    }

    let rows: Vec<(i32, usize, Vec<f64>)> = js
        .lines()
        .filter_map(|line| {
            let rest = line.trim().strip_prefix("[new Date(")?;
            let (date, values) = rest.split_once("),")?;
            let mut date = date.split(',');
            let year = date.next()?.trim().parse().ok()?;
            let month = date.next()?.trim().parse().ok()?;
            let values: Vec<f64> = values
                .trim()
                .trim_end_matches(',')
                .trim_end_matches(']')
                .split(',')
                .map(|value| value.trim().parse().ok())
                .collect::<Option<_>>()?;
            (values.len() == names.len()).then_some((year, month, values))
        })
        .collect();
    let (year, month, latest) = rows.last()?;
    let year_ago = rows
        .len()
        .checked_sub(13)
        .and_then(|row| rows.get(row))
        .map(|(_, _, values)| values);

    let current_ranks = ranks_by_share(latest);
    let previous_ranks = year_ago.map(|values| ranks_by_share(values));
    let languages = names
        .iter()
        .enumerate()
        .map(|(column, name)| LanguageRank {
            rank: current_ranks[column],
            previous_rank: previous_ranks.as_ref().map(|ranks| ranks[column]),
            language: (*name).to_owned(),
            share: latest[column] * 100.0,
            change: year_ago.map(|values| (latest[column] - values[column]) * 100.0),
        })
        .collect();
    Some(LanguageRanking {
        index: RankingIndex::Pypl,
        period: format!("{} {year}", MONTHS.get(*month)?),
        source_url: RankingIndex::Pypl.home(),
        languages,
    })
}

/// 1-based rank of each column, highest share first.
fn ranks_by_share(shares: &[f64]) -> Vec<u32> {
    let mut order: Vec<usize> = (0..shares.len()).collect();
    order.sort_by(|&a, &b| shares[b].total_cmp(&shares[a]));
    let mut ranks = vec![0; shares.len()];
    for (position, column) in order.into_iter().enumerate() {
        ranks[column] = u32::try_from(position + 1).unwrap_or(u32::MAX);
    }
    ranks
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_tiobe_top_table() {
        let html = r#"<html><body><h1>TIOBE Index for November 2026</h1>
          <table id="top20"><thead><tr><th>Nov 2026</th></tr></thead><tbody>
            <tr><td>1</td><td>1</td><td></td><td><img alt="Python page"></td><td>Python</td><td>20.86%</td><td>-2.51%</td></tr>
            <tr><td>3</td><td>4</td><td><img alt="change"></td><td><img alt="Java page"></td><td>Java</td><td>8.89%</td><td>+0.34%</td></tr>
            <tr><td>junk</td></tr>
          </tbody></table></body></html>"#;

        let ranking = parse_tiobe(html).unwrap();

        assert_eq!(ranking.period, "November 2026");
        assert_eq!(ranking.languages.len(), 2);
        assert_eq!(
            ranking.languages[1],
            LanguageRank {
                rank: 3,
                previous_rank: Some(4),
                language: "Java".to_owned(),
                share: 8.89,
                change: Some(0.34),
            }
        );
    }

    #[test]
    fn rejects_pages_without_the_table() {
        assert!(parse_tiobe("<html><body>TIOBE Index for May 2026</body></html>").is_none());
    }

    #[test]
    fn ranks_pypl_shares_and_compares_with_a_year_earlier() {
        // 13 monthly rows, December 2025 to December 2026; Rust overtakes Go over the year.
        // JavaScript months are zero-based, as in PYPL's file.
        let mut js = String::from(
            "graphData = [\n['Date', // begin section languages\n'Go', 'Python', 'Rust'\n// end section languages\n],\n// begin section All\n",
        );
        for row in 0..13 {
            let (year, month) = if row == 0 {
                (2025, 11)
            } else {
                (2026, row - 1)
            };
            let rust = 0.01 + f64::from(row) * 0.002;
            js.push_str(&format!("[new Date({year},{month},1),0.03,0.5,{rust}],\n"));
        }

        let ranking = parse_pypl(&js).unwrap();

        assert_eq!(ranking.period, "December 2026");
        let rank_of = |language: &str| {
            ranking
                .languages
                .iter()
                .find(|entry| entry.language == language)
                .unwrap()
                .clone()
        };
        let rust = rank_of("Rust");
        assert_eq!(rust.rank, 2);
        assert_eq!(rust.previous_rank, Some(3));
        assert!((rust.share - 3.4).abs() < 1e-9);
        assert!((rust.change.unwrap() - 2.4).abs() < 1e-9);
        assert_eq!(rank_of("Python").rank, 1);
        assert_eq!(rank_of("Go").rank, 3);
    }

    #[test]
    fn rejects_unexpected_pypl_files() {
        assert!(parse_pypl("console.log('nothing here')").is_none());
    }
}
