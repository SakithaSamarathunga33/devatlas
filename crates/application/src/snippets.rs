//! Code snippets: small pieces of code kept with a title, language and tags, optionally tied
//! to a link.

use std::future::Future;

use serde::{Deserialize, Serialize};

use crate::organizer::{InvalidInput, OrganizerError, check_id, clean_group, clean_tags};

const MAX_CODE_LEN: usize = 100_000;
const MAX_LANGUAGE_LEN: usize = 40;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snippet {
    pub id: String,
    pub title: String,
    pub language: Option<String>,
    pub code: String,
    pub tags: Vec<String>,
    pub resource_id: Option<String>,
    /// Unix milliseconds.
    pub created_at: i64,
    pub updated_at: i64,
}

/// A snippet as submitted from the UI.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnippetInput {
    pub title: String,
    pub language: Option<String>,
    pub code: String,
    pub tags: Vec<String>,
    pub resource_id: Option<String>,
}

/// Port: persists snippets.
pub trait SnippetStore {
    type Error: std::error::Error;

    fn snippets(&self) -> impl Future<Output = Result<Vec<Snippet>, Self::Error>> + Send;
    fn create_snippet(
        &self,
        input: &SnippetInput,
        now_ms: i64,
    ) -> impl Future<Output = Result<Snippet, Self::Error>> + Send;
    /// Returns whether the snippet exists.
    fn update_snippet(
        &self,
        id: &str,
        input: &SnippetInput,
        now_ms: i64,
    ) -> impl Future<Output = Result<bool, Self::Error>> + Send;
    /// Returns whether the snippet existed.
    fn delete_snippet(&self, id: &str) -> impl Future<Output = Result<bool, Self::Error>> + Send;
}

fn optional(value: Option<String>) -> Option<String> {
    value
        .map(|text| text.trim().to_owned())
        .filter(|text| !text.is_empty())
}

pub(crate) fn clean_snippet(input: SnippetInput) -> Result<SnippetInput, InvalidInput> {
    let (title, _) = clean_group(&input.title, None)?;
    if input.code.trim().is_empty() {
        return Err(InvalidInput::CodeRequired);
    }
    if input.code.chars().count() > MAX_CODE_LEN {
        return Err(InvalidInput::CodeTooLong);
    }
    let language = optional(input.language);
    if language
        .as_ref()
        .is_some_and(|text| text.chars().count() > MAX_LANGUAGE_LEN)
    {
        return Err(InvalidInput::LanguageTooLong);
    }
    let resource_id = optional(input.resource_id);
    if let Some(id) = &resource_id {
        check_id(id)?;
    }
    Ok(SnippetInput {
        title,
        language,
        code: input.code,
        tags: clean_tags(&input.tags)?,
        resource_id,
    })
}

pub async fn list_snippets<S: SnippetStore>(
    store: &S,
) -> Result<Vec<Snippet>, OrganizerError<S::Error>> {
    store.snippets().await.map_err(OrganizerError::Store)
}

pub async fn create_snippet<S: SnippetStore>(
    store: &S,
    input: SnippetInput,
    now_ms: i64,
) -> Result<Snippet, OrganizerError<S::Error>> {
    let input = clean_snippet(input)?;
    store
        .create_snippet(&input, now_ms)
        .await
        .map_err(OrganizerError::Store)
}

pub async fn update_snippet<S: SnippetStore>(
    store: &S,
    id: &str,
    input: SnippetInput,
    now_ms: i64,
) -> Result<bool, OrganizerError<S::Error>> {
    check_id(id)?;
    let input = clean_snippet(input)?;
    store
        .update_snippet(id, &input, now_ms)
        .await
        .map_err(OrganizerError::Store)
}

pub async fn delete_snippet<S: SnippetStore>(
    store: &S,
    id: &str,
) -> Result<bool, OrganizerError<S::Error>> {
    check_id(id)?;
    store
        .delete_snippet(id)
        .await
        .map_err(OrganizerError::Store)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input(title: &str, code: &str) -> SnippetInput {
        SnippetInput {
            title: title.to_owned(),
            language: Some("  Rust ".to_owned()),
            code: code.to_owned(),
            tags: vec![" Async ".to_owned(), "async".to_owned()],
            resource_id: Some("  ".to_owned()),
        }
    }

    #[test]
    fn cleans_title_language_tags_and_blank_links() {
        let cleaned = clean_snippet(input(" Spawn ", "tokio::spawn(x);\n")).unwrap();

        assert_eq!(cleaned.title, "Spawn");
        assert_eq!(cleaned.language.as_deref(), Some("Rust"));
        assert_eq!(cleaned.tags, ["async"]);
        assert_eq!(cleaned.resource_id, None);
    }

    #[test]
    fn keeps_code_whitespace_exactly() {
        let code = "  indented\n\ttabbed\n";

        assert_eq!(clean_snippet(input("x", code)).unwrap().code, code);
    }

    #[test]
    fn requires_a_title_and_code() {
        assert_eq!(
            clean_snippet(input("  ", "x")),
            Err(InvalidInput::NameRequired)
        );
        assert_eq!(
            clean_snippet(input("x", " \n ")),
            Err(InvalidInput::CodeRequired)
        );
    }

    #[test]
    fn refuses_oversized_code() {
        assert_eq!(
            clean_snippet(input("x", &"y".repeat(MAX_CODE_LEN + 1))),
            Err(InvalidInput::CodeTooLong)
        );
    }
}
