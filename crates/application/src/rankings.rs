//! Use case: how popular programming languages are, from the indexes that update monthly
//! (TIOBE: search-engine hits; PYPL: searches for language tutorials).

use std::future::Future;

use serde::Serialize;

/// Languages kept per index.
pub const RANKED_LANGUAGES: usize = 20;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum RankingIndex {
    Tiobe,
    Pypl,
}

impl RankingIndex {
    /// Page users can open to read the index and its method.
    pub const fn home(self) -> &'static str {
        match self {
            Self::Tiobe => "https://www.tiobe.com/tiobe-index/",
            Self::Pypl => "https://pypl.github.io/PYPL.html",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LanguageRank {
    pub rank: u32,
    /// Rank a year earlier, when the index reports it.
    pub previous_rank: Option<u32>,
    pub language: String,
    /// Share in percent.
    pub share: f64,
    /// Change in percentage points over the last year.
    pub change: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LanguageRanking {
    pub index: RankingIndex,
    /// The month the index describes, e.g. "November 2026".
    pub period: String,
    pub source_url: &'static str,
    pub languages: Vec<LanguageRank>,
}

/// Port: reads one index.
pub trait RankingSource {
    type Error: std::error::Error;

    fn ranking(
        &self,
        index: RankingIndex,
    ) -> impl Future<Output = Result<LanguageRanking, Self::Error>> + Send;
}

/// Every index that could be read, each cleaned to its top `RANKED_LANGUAGES` entries with
/// plausible values. An index that fails or comes back empty is left out; the reader logs why.
pub async fn language_rankings<S: RankingSource>(source: &S) -> Vec<LanguageRanking> {
    let mut rankings = Vec::new();
    for index in [RankingIndex::Tiobe, RankingIndex::Pypl] {
        if let Ok(ranking) = source.ranking(index).await {
            let ranking = clean(ranking);
            if !ranking.languages.is_empty() {
                rankings.push(ranking);
            }
        }
    }
    rankings
}

fn clean(mut ranking: LanguageRanking) -> LanguageRanking {
    ranking.languages.retain(|entry| {
        !entry.language.trim().is_empty()
            && entry.rank > 0
            && entry.share.is_finite()
            && (0.0..=100.0).contains(&entry.share)
            && entry.change.is_none_or(f64::is_finite)
    });
    ranking.languages.sort_by_key(|entry| entry.rank);
    ranking.languages.truncate(RANKED_LANGUAGES);
    ranking.source_url = ranking.index.home();
    ranking
}

#[cfg(test)]
mod tests {
    use std::pin::pin;
    use std::task::{Context, Poll, Waker};

    use super::*;

    #[derive(Debug, thiserror::Error)]
    #[error("offline")]
    struct Offline;

    /// TIOBE answers with messy data; PYPL is offline.
    struct FakeIndexes;

    impl RankingSource for FakeIndexes {
        type Error = Offline;

        async fn ranking(&self, index: RankingIndex) -> Result<LanguageRanking, Offline> {
            if index == RankingIndex::Pypl {
                return Err(Offline);
            }
            let entry = |rank, language: &str, share| LanguageRank {
                rank,
                previous_rank: None,
                language: language.to_owned(),
                share,
                change: Some(0.5),
            };
            let mut languages = vec![
                entry(2, "C", 11.5),
                entry(1, "Python", 20.9),
                entry(3, "", 9.0),
                entry(4, "Broken", f64::NAN),
            ];
            languages.extend((5..40).map(|rank| entry(rank, "Other", 0.1)));
            Ok(LanguageRanking {
                index,
                period: "November 2026".to_owned(),
                source_url: "https://example.com",
                languages,
            })
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

    #[test]
    fn keeps_readable_indexes_sorted_cleaned_and_trimmed() {
        let rankings = block_on(language_rankings(&FakeIndexes));

        assert_eq!(rankings.len(), 1, "the offline index is left out");
        let tiobe = &rankings[0];
        assert_eq!(tiobe.index, RankingIndex::Tiobe);
        assert_eq!(tiobe.source_url, "https://www.tiobe.com/tiobe-index/");
        assert_eq!(tiobe.languages.len(), RANKED_LANGUAGES);
        assert_eq!(tiobe.languages[0].language, "Python");
        assert_eq!(tiobe.languages[1].language, "C");
        assert!(
            tiobe
                .languages
                .iter()
                .all(|entry| entry.language != "Broken" && !entry.language.is_empty())
        );
    }
}
