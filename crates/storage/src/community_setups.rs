//! Shared agent setups on the Community server, read and written as the signed-in account.
//! What comes back is checked by the application layer like any other Community data.

use devatlas_application::agent_setups::{
    self, PublishSetupRequest, SetupPage, SetupServer, SetupSummary, SharedSetup, UntrustedItem,
    UntrustedSetup,
};
use devatlas_application::community::PAGE_SIZE;
use reqwest::StatusCode;
use reqwest::header::CONTENT_TYPE;
use serde::Deserialize;

use crate::community::{RawOwner, SupabaseCommunity, SupabaseError, error_code, refusal};

// `!owner_id`: reports give a second path to profiles, which PostgREST refuses as ambiguous.
const SETUP_FIELDS: &str = "owner_id,description,skill_count,mcp_server_count,plugin_count,updated_at,owner:profiles!owner_id(username,avatar_url)";
const ITEM_FIELDS: &str =
    "items:shared_setup_items(position,kind,name,description,source_type,source,tools)";

#[derive(Deserialize)]
struct RawItem {
    position: i64,
    kind: String,
    name: String,
    description: Option<String>,
    source_type: Option<String>,
    source: Option<String>,
    #[serde(default)]
    tools: Vec<String>,
}

#[derive(Deserialize)]
struct RawSetup {
    owner_id: String,
    description: Option<String>,
    skill_count: i64,
    mcp_server_count: i64,
    plugin_count: i64,
    updated_at: String,
    owner: Option<RawOwner>,
    #[serde(default)]
    items: Vec<RawItem>,
}

fn summary(raw: &RawSetup) -> Option<SetupSummary> {
    let owner = raw.owner.as_ref()?;
    agent_setups::untrusted_setup(&UntrustedSetup {
        owner_id: &raw.owner_id,
        username: &owner.username,
        avatar_url: owner.avatar_url.as_deref(),
        description: raw.description.as_deref(),
        counts: [raw.skill_count, raw.mcp_server_count, raw.plugin_count],
        updated_at: &raw.updated_at,
    })
}

/// A page of setups; malformed ones are left out, but still count towards paging.
fn parse_page(body: &[u8], offset: u32) -> Result<SetupPage, serde_json::Error> {
    let raw: Vec<RawSetup> = serde_json::from_slice(body)?;
    Ok(SetupPage {
        setups: raw.iter().filter_map(summary).collect(),
        next_offset: (raw.len() >= PAGE_SIZE as usize).then(|| offset.saturating_add(PAGE_SIZE)),
    })
}

/// One setup with its items in order, dropping items that fail the checks.
fn parse_setup(body: &[u8]) -> Result<Option<SharedSetup>, serde_json::Error> {
    let raw: Vec<RawSetup> = serde_json::from_slice(body)?;
    let Some(mut first) = raw.into_iter().next() else {
        return Ok(None);
    };
    let Some(summary) = summary(&first) else {
        return Ok(None);
    };
    first.items.sort_by_key(|item| item.position);
    let items = first
        .items
        .iter()
        .take(agent_setups::MAX_ITEMS)
        .filter_map(|item| {
            agent_setups::untrusted_item(&UntrustedItem {
                kind: &item.kind,
                name: &item.name,
                description: item.description.as_deref(),
                source_type: item.source_type.as_deref(),
                source: item.source.as_deref(),
                tools: &item.tools,
            })
        })
        .collect();
    Ok(Some(SharedSetup { summary, items }))
}

impl SetupServer for SupabaseCommunity {
    type Error = SupabaseError;

    async fn setups(&self, offset: u32) -> Result<SetupPage, SupabaseError> {
        let mut url = self.rest("shared_setups")?;
        url.query_pairs_mut()
            .append_pair("select", SETUP_FIELDS)
            .append_pair("is_hidden", "is.false")
            // `owner_id` breaks ties, so paging never repeats or skips a setup.
            .append_pair("order", "updated_at.desc,owner_id.desc")
            .append_pair("limit", &PAGE_SIZE.to_string())
            .append_pair("offset", &offset.to_string());
        Ok(parse_page(&self.get(url).await?, offset)?)
    }

    async fn setup(&self, owner_id: &str) -> Result<Option<SharedSetup>, SupabaseError> {
        let mut url = self.rest("shared_setups")?;
        url.query_pairs_mut()
            .append_pair("select", &format!("{SETUP_FIELDS},{ITEM_FIELDS}"))
            .append_pair("owner_id", &format!("eq.{owner_id}"));
        Ok(parse_setup(&self.get(url).await?)?)
    }

    async fn publish_setup(&self, request: &PublishSetupRequest) -> Result<(), SupabaseError> {
        let url = self.rest("rpc/publish_setup")?;
        let body = serde_json::to_vec(request)?;
        let sent = self
            .authed(|http| {
                http.post(url.clone())
                    .header(CONTENT_TYPE, "application/json")
                    .body(body.clone())
            })
            .await?;
        sent.map(drop)
            .map_err(|(status, body)| refusal(status, &body))
    }

    async fn unpublish_setup(&self, owner_id: &str) -> Result<(), SupabaseError> {
        let mut url = self.rest("shared_setups")?;
        // Row level security limits the delete to the caller's own setup.
        url.query_pairs_mut()
            .append_pair("owner_id", &format!("eq.{owner_id}"));
        let sent = self
            .authed(|http| http.delete(url.clone()).header("Prefer", "return=minimal"))
            .await?;
        sent.map(drop)
            .map_err(|(status, body)| refusal(status, &body))
    }

    async fn report_setup(
        &self,
        owner_id: &str,
        reason: Option<&str>,
    ) -> Result<bool, SupabaseError> {
        let url = self.rest("setup_reports")?;
        let body = serde_json::json!({ "owner_id": owner_id, "reason": reason }).to_string();
        let sent = self
            .authed(|http| {
                http.post(url.clone())
                    .header(CONTENT_TYPE, "application/json")
                    .header("Prefer", "return=minimal")
                    .body(body.clone())
            })
            .await?;
        match sent {
            Ok(_) => Ok(true),
            // One report per account and setup: a unique violation.
            Err((StatusCode::CONFLICT, body)) if error_code(&body).as_deref() == Some("23505") => {
                Ok(false)
            }
            Err((status, body)) => Err(refusal(status, &body)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const OWNER: &str = "11111111-2222-4333-8444-555555555555";

    #[test]
    fn parses_a_setup_in_position_order_dropping_unsafe_items() {
        let body = format!(
            r#"[{{"owner_id":"{OWNER}","description":"Mine","skill_count":1,"mcp_server_count":2,
            "plugin_count":0,"updated_at":"2026-11-15T10:00:00+00:00",
            "owner":{{"username":"octocat","avatar_url":null}},
            "items":[
              {{"position":2,"kind":"mcp-server","name":"fetch","description":null,"source_type":"pypi","source":"mcp-server-fetch","tools":["codex"]}},
              {{"position":1,"kind":"mcp-server","name":"$(id)","description":null,"source_type":null,"source":null,"tools":["codex"]}},
              {{"position":0,"kind":"skill","name":"hallmark","description":"Design","source_type":"github","source":"nutlope/hallmark","tools":["claude-code"]}}
            ]}}]"#
        );
        let setup = parse_setup(body.as_bytes()).unwrap().unwrap();
        let names: Vec<&str> = setup
            .items
            .iter()
            .map(|entry| entry.item.name.as_str())
            .collect();
        assert_eq!(names, ["hallmark", "fetch"]);
        assert_eq!(setup.summary.owner.username, "octocat");
        assert_eq!(setup.summary.mcp_server_count, 2);
        assert_eq!(parse_setup(b"[]").unwrap(), None);
    }

    #[test]
    fn a_page_skips_malformed_rows_but_pages_on_the_raw_count() {
        let row = format!(
            r#"{{"owner_id":"{OWNER}","description":null,"skill_count":0,"mcp_server_count":0,
            "plugin_count":0,"updated_at":"2026-11-15T10:00:00Z","owner":{{"username":"a","avatar_url":null}}}}"#
        );
        let bad = row.replace(OWNER, "nope");
        let rows: Vec<&str> = std::iter::once(bad.as_str())
            .chain(std::iter::repeat_n(row.as_str(), PAGE_SIZE as usize - 1))
            .collect();
        let page = parse_page(format!("[{}]", rows.join(",")).as_bytes(), 0).unwrap();
        assert_eq!(page.setups.len(), PAGE_SIZE as usize - 1);
        assert_eq!(page.next_offset, Some(PAGE_SIZE));
    }
}
