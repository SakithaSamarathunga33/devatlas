//! Agent setups: the skills, MCP servers and plugins a developer uses in Claude Code and Codex,
//! shared to Community so others can see them and copy how to install each one.
//!
//! Only an item's name, a short description and its public source (a GitHub repository, an npm
//! or PyPI package) are ever published, never an MCP server's command, arguments, environment,
//! headers or any file path. Install commands are built here from those checked fields, both
//! when sharing and when reading someone else's setup, so a setup can't carry shell text.

use std::collections::{BTreeMap, BTreeSet};
use std::future::Future;

use serde::{Deserialize, Serialize};

use crate::agent::clean_text;
use crate::community::{
    self, CommunityInputError, MAX_DESCRIPTION_CHARS, MAX_USERNAME_CHARS, Owner, SharedLink,
    avatar_url, check_id, is_timestamp, optional_text,
};

/// The server's limits, checked here first so sharing fails with a clear message.
pub const MAX_ITEMS: usize = 300;
pub const MAX_ITEM_DESCRIPTION_CHARS: usize = 300;
const MAX_NAME_LEN: usize = 100;
const MAX_REPO_OWNER_LEN: usize = 39;
const MAX_PACKAGE_LEN: usize = 214;
/// Paging deeper than this is no longer browsing.
const MAX_OFFSET: u32 = 10_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SetupKind {
    Skill,
    McpServer,
    Plugin,
}

impl SetupKind {
    fn as_str(self) -> &'static str {
        match self {
            Self::Skill => "skill",
            Self::McpServer => "mcp-server",
            Self::Plugin => "plugin",
        }
    }

    fn parse(text: &str) -> Option<Self> {
        [Self::Skill, Self::McpServer, Self::Plugin]
            .into_iter()
            .find(|kind| kind.as_str() == text)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SetupTool {
    ClaudeCode,
    Codex,
}

impl SetupTool {
    fn as_str(self) -> &'static str {
        match self {
            Self::ClaudeCode => "claude-code",
            Self::Codex => "codex",
        }
    }

    fn parse(text: &str) -> Option<Self> {
        [Self::ClaudeCode, Self::Codex]
            .into_iter()
            .find(|tool| tool.as_str() == text)
    }
}

/// Where an item can be installed from.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", content = "id", rename_all = "kebab-case")]
pub enum SetupSource {
    /// `owner/repo`.
    Github(String),
    /// A package name, `@scope/` allowed, without a version.
    Npm(String),
    Pypi(String),
}

impl SetupSource {
    fn type_name(&self) -> &'static str {
        match self {
            Self::Github(_) => "github",
            Self::Npm(_) => "npm",
            Self::Pypi(_) => "pypi",
        }
    }

    fn id(&self) -> &str {
        match self {
            Self::Github(id) | Self::Npm(id) | Self::Pypi(id) => id,
        }
    }

    fn parse(type_name: &str, id: &str) -> Option<Self> {
        let source = match type_name {
            "github" => Self::Github(id.to_owned()),
            "npm" => Self::Npm(id.to_owned()),
            "pypi" => Self::Pypi(id.to_owned()),
            _ => return None,
        };
        source.is_valid().then_some(source)
    }

    fn is_valid(&self) -> bool {
        match self {
            Self::Github(repo) => repo.split_once('/').is_some_and(|(owner, name)| {
                is_word(owner, MAX_REPO_OWNER_LEN, &['-'])
                    && is_word(name, MAX_NAME_LEN, &['-', '_', '.'])
            }),
            Self::Npm(package) => {
                let unscoped = match package.strip_prefix('@') {
                    Some(scoped) => match scoped.split_once('/') {
                        Some((scope, name)) if is_npm_part(scope) => name,
                        _ => return false,
                    },
                    None => package,
                };
                // `npx foo.tgz` runs a local archive, not a package.
                let archive = [".tgz", ".tar", ".tar.gz"]
                    .iter()
                    .any(|suffix| unscoped.ends_with(suffix));
                package.len() <= MAX_PACKAGE_LEN && is_npm_part(unscoped) && !archive
            }
            Self::Pypi(project) => is_word(project, MAX_NAME_LEN, &['-', '_', '.']),
        }
    }

    /// The source's public page.
    fn url(&self) -> String {
        match self {
            Self::Github(repo) => format!("https://github.com/{repo}"),
            Self::Npm(package) => format!("https://www.npmjs.com/package/{package}"),
            Self::Pypi(project) => format!("https://pypi.org/project/{project}/"),
        }
    }
}

/// ASCII letters and digits plus `extra`, starting with a letter or digit, so it can never
/// read as a command-line flag or a path.
fn is_word(text: &str, max: usize, extra: &[char]) -> bool {
    text.len() <= max
        && text.starts_with(|c: char| c.is_ascii_alphanumeric())
        && text
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || extra.contains(&c))
}

fn is_npm_part(text: &str) -> bool {
    is_word(text, MAX_PACKAGE_LEN, &['-', '_', '.', '~'])
}

/// One skill, MCP server or plugin as found on this computer or read from Community.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupItem {
    pub kind: SetupKind,
    pub name: String,
    pub description: Option<String>,
    pub source: Option<SetupSource>,
    /// Which agents it is set up in; never empty.
    pub tools: Vec<SetupTool>,
}

impl SetupItem {
    fn is_valid_name(&self) -> bool {
        let simple = |name: &str| is_word(name, MAX_NAME_LEN, &['-', '_', '.']);
        match self.kind {
            // `plugin@marketplace`, as Claude Code and Codex name them.
            SetupKind::Plugin => {
                self.name.len() <= MAX_NAME_LEN
                    && self
                        .name
                        .split_once('@')
                        .is_some_and(|(plugin, marketplace)| simple(plugin) && simple(marketplace))
            }
            SetupKind::Skill | SetupKind::McpServer => simple(&self.name),
        }
    }

    /// The item with its text cleaned and an invalid source dropped, or `None` when its name
    /// isn't one an install command could safely hold.
    fn checked(self) -> Option<Self> {
        let mut tools = self.tools;
        tools.sort();
        tools.dedup();
        let item = Self {
            description: optional_text(self.description.as_deref(), MAX_ITEM_DESCRIPTION_CHARS),
            source: self.source.filter(SetupSource::is_valid),
            tools,
            ..self
        };
        (item.is_valid_name() && !item.tools.is_empty()).then_some(item)
    }

    fn key(&self) -> String {
        format!("{}:{}", self.kind.as_str(), self.name)
    }
}

/// A command that installs an item; `tool` is `None` when any agent can run it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallCommand {
    pub tool: Option<SetupTool>,
    pub command: String,
}

/// An item as the UI shows it: with its source's page and the commands that install it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupEntry {
    #[serde(flatten)]
    pub item: SetupItem,
    /// Picks the item when sharing: `kind:name`.
    pub key: String,
    pub link: Option<SharedLink>,
    pub install: Vec<InstallCommand>,
}

fn install_commands(item: &SetupItem) -> Vec<InstallCommand> {
    let name = &item.name;
    let both = |run: String| {
        [SetupTool::ClaudeCode, SetupTool::Codex]
            .into_iter()
            .map(|tool| InstallCommand {
                tool: Some(tool),
                command: match tool {
                    // User scope, where it was found; Claude Code's default is one project.
                    SetupTool::ClaudeCode => format!("claude mcp add -s user {name} -- {run}"),
                    SetupTool::Codex => format!("codex mcp add {name} -- {run}"),
                },
            })
            .collect()
    };
    match (item.kind, &item.source) {
        (SetupKind::Skill, Some(SetupSource::Github(repo))) => vec![InstallCommand {
            tool: None,
            command: format!("npx skills add {repo} --skill {name}"),
        }],
        (SetupKind::McpServer, Some(SetupSource::Npm(package))) => {
            both(format!("npx -y {package}"))
        }
        (SetupKind::McpServer, Some(SetupSource::Pypi(project))) => both(format!("uvx {project}")),
        (SetupKind::Plugin, Some(SetupSource::Github(repo)))
            if item.tools.contains(&SetupTool::ClaudeCode) =>
        {
            vec![InstallCommand {
                tool: Some(SetupTool::ClaudeCode),
                command: format!("/plugin marketplace add {repo}\n/plugin install {name}"),
            }]
        }
        _ => Vec::new(),
    }
}

fn entry(item: SetupItem) -> SetupEntry {
    let link = item
        .source
        .as_ref()
        .and_then(|source| community::untrusted_link(&source.url(), &item.name));
    SetupEntry {
        key: item.key(),
        install: install_commands(&item),
        link,
        item,
    }
}

/// Port: what is installed on this computer. Unreadable files are left out, not errors.
pub trait LocalSetup {
    fn detect(&self) -> Vec<SetupItem>;
}

/// What this computer has that could be shared.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupPreview {
    pub items: Vec<SetupEntry>,
    /// Items left out because their names can't be shared safely.
    pub skipped: usize,
}

/// `detected`, checked, with an item set up in both agents listed once, by kind then name.
pub fn preview(detected: Vec<SetupItem>) -> SetupPreview {
    let total = detected.len();
    let mut merged: BTreeMap<(SetupKind, String), SetupItem> = BTreeMap::new();
    let mut valid = 0;
    for item in detected.into_iter().filter_map(SetupItem::checked) {
        valid += 1;
        let key = (item.kind, item.name.to_ascii_lowercase());
        match merged.get_mut(&key) {
            Some(known) => {
                known.tools.extend(item.tools);
                known.tools.sort();
                known.tools.dedup();
                if known.source.is_none() {
                    known.source = item.source;
                }
                if known.description.is_none() {
                    known.description = item.description;
                }
            }
            None => {
                merged.insert(key, item);
            }
        }
    }
    SetupPreview {
        items: merged.into_values().map(entry).collect(),
        skipped: total - valid,
    }
}

/// A shared setup as a list shows it. A setup is its owner's, so it goes by the owner's id.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupSummary {
    pub owner: Owner,
    pub description: Option<String>,
    pub skill_count: u32,
    pub mcp_server_count: u32,
    pub plugin_count: u32,
    /// An ISO 8601 timestamp.
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SharedSetup {
    #[serde(flatten)]
    pub summary: SetupSummary,
    pub items: Vec<SetupEntry>,
}

/// A page of setups; `next_offset` is `None` on the last page.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupPage {
    pub setups: Vec<SetupSummary>,
    pub next_offset: Option<u32>,
}

/// Raw fields of a setup from the server.
pub struct UntrustedSetup<'a> {
    pub owner_id: &'a str,
    pub username: &'a str,
    pub avatar_url: Option<&'a str>,
    pub description: Option<&'a str>,
    pub counts: [i64; 3],
    pub updated_at: &'a str,
}

/// A setup from the server, or `None` when its owner id or timestamp is malformed.
pub fn untrusted_setup(raw: &UntrustedSetup<'_>) -> Option<SetupSummary> {
    if check_id(raw.owner_id).is_err() || !is_timestamp(raw.updated_at) {
        return None;
    }
    let count = |raw: i64| u32::try_from(raw.clamp(0, MAX_ITEMS as i64)).unwrap_or(0);
    Some(SetupSummary {
        owner: Owner {
            id: raw.owner_id.to_ascii_lowercase(),
            username: optional_text(Some(raw.username), MAX_USERNAME_CHARS)
                .unwrap_or_else(|| "unknown".to_owned()),
            avatar_url: raw.avatar_url.and_then(avatar_url),
        },
        description: optional_text(raw.description, MAX_DESCRIPTION_CHARS),
        skill_count: count(raw.counts[0]),
        mcp_server_count: count(raw.counts[1]),
        plugin_count: count(raw.counts[2]),
        updated_at: raw.updated_at.to_owned(),
    })
}

/// Raw fields of one item from the server.
pub struct UntrustedItem<'a> {
    pub kind: &'a str,
    pub name: &'a str,
    pub description: Option<&'a str>,
    pub source_type: Option<&'a str>,
    pub source: Option<&'a str>,
    pub tools: &'a [String],
}

/// An item from the server, held to the same checks as one being shared, or `None`.
pub fn untrusted_item(raw: &UntrustedItem<'_>) -> Option<SetupEntry> {
    let source = match (raw.source_type, raw.source) {
        (Some(type_name), Some(id)) => SetupSource::parse(type_name, id),
        _ => None,
    };
    let item = SetupItem {
        kind: SetupKind::parse(raw.kind)?,
        name: raw.name.to_owned(),
        description: raw.description.map(str::to_owned),
        source,
        tools: raw
            .tools
            .iter()
            .filter_map(|tool| SetupTool::parse(tool))
            .collect(),
    };
    item.checked().map(entry)
}

/// Exactly what sharing sends: the body of the server's `publish_setup` call.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PublishSetupRequest {
    pub description: Option<String>,
    pub items: Vec<PublishItem>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PublishItem {
    pub kind: &'static str,
    pub name: String,
    pub description: Option<String>,
    pub source_type: Option<&'static str>,
    pub source: Option<String>,
    pub tools: Vec<&'static str>,
}

impl From<&SetupItem> for PublishItem {
    fn from(item: &SetupItem) -> Self {
        Self {
            kind: item.kind.as_str(),
            name: item.name.clone(),
            description: item.description.clone(),
            source_type: item.source.as_ref().map(SetupSource::type_name),
            source: item.source.as_ref().map(|source| source.id().to_owned()),
            tools: item.tools.iter().map(|tool| tool.as_str()).collect(),
        }
    }
}

/// Port: shared setups on the Community server.
pub trait SetupServer {
    type Error: std::error::Error;

    fn setups(&self, offset: u32) -> impl Future<Output = Result<SetupPage, Self::Error>> + Send;
    fn setup(
        &self,
        owner_id: &str,
    ) -> impl Future<Output = Result<Option<SharedSetup>, Self::Error>> + Send;
    /// Publishes or replaces the signed-in account's setup.
    fn publish_setup(
        &self,
        request: &PublishSetupRequest,
    ) -> impl Future<Output = Result<(), Self::Error>> + Send;
    fn unpublish_setup(
        &self,
        owner_id: &str,
    ) -> impl Future<Output = Result<(), Self::Error>> + Send;
    /// Returns `false` when this account had already reported the setup.
    fn report_setup(
        &self,
        owner_id: &str,
        reason: Option<&str>,
    ) -> impl Future<Output = Result<bool, Self::Error>> + Send;
}

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum SetupInputError {
    #[error("Choose at least one skill, MCP server or plugin to share.")]
    NothingChosen,
    #[error(
        "Something you chose is no longer installed in Claude Code or Codex. Close this and open it again."
    )]
    NoLongerInstalled,
    #[error("A shared setup holds at most {MAX_ITEMS} items; you chose {0}.")]
    TooManyItems(usize),
}

#[derive(Debug, thiserror::Error)]
pub enum SetupError<S: std::error::Error> {
    #[error(transparent)]
    Invalid(#[from] SetupInputError),
    #[error(transparent)]
    Community(#[from] CommunityInputError),
    #[error(transparent)]
    Server(S),
}

/// Shared setups, newest first.
pub async fn browse<S: SetupServer>(server: &S, offset: u32) -> Result<SetupPage, S::Error> {
    if offset > MAX_OFFSET {
        return Ok(SetupPage {
            setups: Vec::new(),
            next_offset: None,
        });
    }
    server.setups(offset).await
}

/// One account's shared setup, or `None` when it hasn't shared one.
pub async fn setup<S: SetupServer>(
    server: &S,
    owner_id: &str,
) -> Result<Option<SharedSetup>, SetupError<S::Error>> {
    let owner_id = check_id(owner_id)?.to_ascii_lowercase();
    server.setup(&owner_id).await.map_err(SetupError::Server)
}

/// Shares the items of `detected` whose keys are in `chosen`, replacing the account's earlier
/// setup. Only what this computer has can be shared, as the preview showed it.
pub async fn share<S: SetupServer>(
    server: &S,
    detected: Vec<SetupItem>,
    chosen: &[String],
    description: Option<&str>,
) -> Result<(), SetupError<S::Error>> {
    let chosen: BTreeSet<&str> = chosen.iter().map(String::as_str).collect();
    match chosen.len() {
        0 => return Err(SetupInputError::NothingChosen.into()),
        count if count > MAX_ITEMS => return Err(SetupInputError::TooManyItems(count).into()),
        _ => {}
    }
    let items: Vec<PublishItem> = preview(detected)
        .items
        .iter()
        .filter(|entry| chosen.contains(entry.key.as_str()))
        .map(|entry| PublishItem::from(&entry.item))
        .collect();
    // Never a smaller setup than the one the user picked.
    if items.len() != chosen.len() {
        return Err(SetupInputError::NoLongerInstalled.into());
    }
    let request = PublishSetupRequest {
        description: optional_text(description, MAX_DESCRIPTION_CHARS),
        items,
    };
    server
        .publish_setup(&request)
        .await
        .map_err(SetupError::Server)
}

/// Takes the account's setup down.
pub async fn unshare<S: SetupServer>(
    server: &S,
    owner_id: &str,
) -> Result<(), SetupError<S::Error>> {
    let owner_id = check_id(owner_id)?.to_ascii_lowercase();
    server
        .unpublish_setup(&owner_id)
        .await
        .map_err(SetupError::Server)
}

/// Reports a setup to the moderators. Returns `false` when already reported.
pub async fn report<S: SetupServer>(
    server: &S,
    owner_id: &str,
    reason: Option<&str>,
) -> Result<bool, SetupError<S::Error>> {
    let owner_id = check_id(owner_id)?.to_ascii_lowercase();
    let reason = reason.map(str::trim).filter(|text| !text.is_empty());
    if reason.is_some_and(|text| text.chars().count() > community::MAX_REASON_CHARS) {
        return Err(CommunityInputError::ReasonTooLong.into());
    }
    let reason = reason.map(|text| clean_text(text, community::MAX_REASON_CHARS));
    server
        .report_setup(&owner_id, reason.as_deref())
        .await
        .map_err(SetupError::Server)
}

#[cfg(test)]
#[path = "agent_setups_tests.rs"]
mod tests;
