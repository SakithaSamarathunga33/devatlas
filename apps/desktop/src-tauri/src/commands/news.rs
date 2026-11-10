use devatlas_application::news::{self, NewsFeed, TopStory};
use devatlas_application::rankings::{self, LanguageRanking};
use devatlas_storage::news::{NewsError, NewsReader};
use tauri::State;

/// The news, top-story and ranking reader with its caches, created once at startup.
pub struct News {
    reader: NewsReader,
}

impl News {
    pub fn new() -> Result<Self, NewsError> {
        Ok(Self {
            reader: NewsReader::new()?,
        })
    }
}

/// Latest posts from the official blogs of languages, frameworks, databases and tools.
#[tauri::command]
pub async fn list_news(news: State<'_, News>) -> Result<NewsFeed, String> {
    Ok(news::latest_news(&news.reader).await)
}

/// The stories developers are discussing now (Hacker News front page), best first.
#[tauri::command]
pub async fn list_top_stories(news: State<'_, News>) -> Result<Vec<TopStory>, String> {
    news::top_stories(&news.reader).await.map_err(|error| {
        tracing::warn!(%error, "top stories unavailable");
        format!("Top stories couldn't be loaded: {error}.")
    })
}

/// Monthly language-popularity indexes (TIOBE, PYPL) that could be read.
#[tauri::command]
pub async fn list_language_rankings(news: State<'_, News>) -> Result<Vec<LanguageRanking>, String> {
    Ok(rankings::language_rankings(&news.reader).await)
}
