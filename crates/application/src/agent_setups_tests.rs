use std::convert::Infallible;
use std::pin::pin;
use std::sync::Mutex;
use std::task::{Context, Poll, Waker};

use super::*;

const OWNER: &str = "11111111-2222-4333-8444-555555555555";

fn block_on<F: Future>(future: F) -> F::Output {
    let mut future = pin!(future);
    let mut cx = Context::from_waker(Waker::noop());
    loop {
        if let Poll::Ready(output) = future.as_mut().poll(&mut cx) {
            return output;
        }
    }
}

fn item(kind: SetupKind, name: &str, source: Option<SetupSource>, tool: SetupTool) -> SetupItem {
    SetupItem {
        kind,
        name: name.to_owned(),
        description: None,
        source,
        tools: vec![tool],
    }
}

fn npm(package: &str) -> Option<SetupSource> {
    Some(SetupSource::Npm(package.to_owned()))
}

fn github(repo: &str) -> Option<SetupSource> {
    Some(SetupSource::Github(repo.to_owned()))
}

fn commands(entry: &SetupEntry) -> Vec<&str> {
    entry
        .install
        .iter()
        .map(|command| command.command.as_str())
        .collect()
}

#[test]
fn lists_an_item_set_up_in_both_agents_once_and_drops_unsafe_names() {
    let detected = vec![
        item(
            SetupKind::Skill,
            "hallmark",
            github("nutlope/hallmark"),
            SetupTool::ClaudeCode,
        ),
        item(
            SetupKind::McpServer,
            "github",
            npm("@modelcontextprotocol/server-github"),
            SetupTool::Codex,
        ),
        item(SetupKind::McpServer, "github", None, SetupTool::ClaudeCode),
        item(
            SetupKind::McpServer,
            "--evil",
            npm("left-pad"),
            SetupTool::Codex,
        ),
        item(SetupKind::Skill, "a; rm -rf ~", None, SetupTool::Codex),
        item(
            SetupKind::Plugin,
            "no-marketplace",
            github("o/r"),
            SetupTool::ClaudeCode,
        ),
    ];
    let preview = preview(detected);

    let keys: Vec<&str> = preview
        .items
        .iter()
        .map(|entry| entry.key.as_str())
        .collect();
    assert_eq!(keys, ["skill:hallmark", "mcp-server:github"]);
    assert_eq!(preview.skipped, 3);
    let github = &preview.items[1];
    assert_eq!(github.item.tools, [SetupTool::ClaudeCode, SetupTool::Codex]);
    assert_eq!(
        github.item.source,
        npm("@modelcontextprotocol/server-github"),
        "the agent that knows the source supplies it"
    );
}

#[test]
fn builds_install_commands_only_from_checked_sources() {
    let entries = preview(vec![
        item(
            SetupKind::Skill,
            "hallmark",
            github("nutlope/hallmark"),
            SetupTool::ClaudeCode,
        ),
        item(
            SetupKind::McpServer,
            "fetch",
            Some(SetupSource::Pypi("mcp-server-fetch".to_owned())),
            SetupTool::Codex,
        ),
        item(
            SetupKind::Plugin,
            "ponytail@ponytail",
            github("DietrichGebert/ponytail"),
            SetupTool::ClaudeCode,
        ),
        item(
            SetupKind::McpServer,
            "local",
            npm("./server.js"),
            SetupTool::ClaudeCode,
        ),
        item(
            SetupKind::Plugin,
            "browser@openai-bundled",
            None,
            SetupTool::Codex,
        ),
    ])
    .items;
    let by_key = |key: &str| entries.iter().find(|entry| entry.key == key).unwrap();

    assert_eq!(
        commands(by_key("skill:hallmark")),
        ["npx skills add nutlope/hallmark --skill hallmark"]
    );
    assert_eq!(
        commands(by_key("mcp-server:fetch")),
        [
            "claude mcp add -s user fetch -- uvx mcp-server-fetch",
            "codex mcp add fetch -- uvx mcp-server-fetch"
        ]
    );
    assert_eq!(
        commands(by_key("plugin:ponytail@ponytail")),
        ["/plugin marketplace add DietrichGebert/ponytail\n/plugin install ponytail@ponytail"]
    );
    let local = by_key("mcp-server:local");
    assert_eq!(local.item.source, None, "a path is never a public source");
    assert!(local.install.is_empty() && local.link.is_none());
    assert!(by_key("plugin:browser@openai-bundled").install.is_empty());
    assert_eq!(
        by_key("skill:hallmark").link.as_ref().unwrap().url,
        "https://github.com/nutlope/hallmark"
    );
}

#[test]
fn someone_elses_item_is_held_to_the_same_checks() {
    let tools = ["codex".to_owned(), "vim".to_owned()];
    let raw = |kind, name, source_type, source| UntrustedItem {
        kind,
        name,
        description: Some("Fetches\u{202e} pages"),
        source_type,
        source,
        tools: &tools,
    };

    let fine =
        untrusted_item(&raw("mcp-server", "fetch", Some("npm"), Some("@scope/pkg"))).unwrap();
    assert_eq!(fine.item.tools, [SetupTool::Codex]);
    assert_eq!(fine.item.description.as_deref(), Some("Fetches pages"));
    assert_eq!(
        commands(&fine)[0],
        "claude mcp add -s user fetch -- npx -y @scope/pkg"
    );

    let archive = untrusted_item(&raw("mcp-server", "fetch", Some("npm"), Some("evil.tgz")));
    assert!(
        archive.is_some_and(|entry| entry.install.is_empty()),
        "an archive name would run a local file"
    );
    let shell = untrusted_item(&raw(
        "mcp-server",
        "fetch",
        Some("npm"),
        Some("x && curl evil"),
    ))
    .unwrap();
    assert!(
        shell.install.is_empty(),
        "a source with shell text is dropped"
    );
    assert!(untrusted_item(&raw("mcp-server", "x`id`", None, None)).is_none());
    assert!(untrusted_item(&raw("script", "fetch", None, None)).is_none());
    assert!(
        untrusted_item(&UntrustedItem {
            tools: &[],
            ..raw("skill", "fine", None, None)
        })
        .is_none(),
        "an item in no agent isn't one"
    );
}

#[derive(Default)]
struct FakeServer {
    published: Mutex<Vec<PublishSetupRequest>>,
}

impl SetupServer for FakeServer {
    type Error = Infallible;

    async fn setups(&self, _offset: u32) -> Result<SetupPage, Infallible> {
        Ok(SetupPage {
            setups: Vec::new(),
            next_offset: None,
        })
    }

    async fn setup(&self, _owner_id: &str) -> Result<Option<SharedSetup>, Infallible> {
        Ok(None)
    }

    async fn publish_setup(&self, request: &PublishSetupRequest) -> Result<(), Infallible> {
        self.published.lock().unwrap().push(request.clone());
        Ok(())
    }

    async fn unpublish_setup(&self, _owner_id: &str) -> Result<(), Infallible> {
        Ok(())
    }

    async fn report_setup(
        &self,
        _owner_id: &str,
        _reason: Option<&str>,
    ) -> Result<bool, Infallible> {
        Ok(true)
    }
}

#[test]
fn shares_only_the_chosen_items_and_only_names_and_sources() {
    let server = FakeServer::default();
    let detected = || {
        vec![
            item(
                SetupKind::Skill,
                "hallmark",
                github("nutlope/hallmark"),
                SetupTool::ClaudeCode,
            ),
            item(SetupKind::McpServer, "private-db", None, SetupTool::Codex),
        ]
    };

    let none = block_on(share(&server, detected(), &[], None));
    assert!(matches!(
        none,
        Err(SetupError::Invalid(SetupInputError::NothingChosen))
    ));
    let gone = block_on(share(
        &server,
        detected(),
        &["skill:hallmark".to_owned(), "skill:uninstalled".to_owned()],
        None,
    ));
    assert!(
        matches!(
            gone,
            Err(SetupError::Invalid(SetupInputError::NoLongerInstalled))
        ),
        "never publishes less than was picked"
    );
    assert!(server.published.lock().unwrap().is_empty());

    block_on(share(
        &server,
        detected(),
        &["skill:hallmark".to_owned()],
        Some("  My Claude setup  "),
    ))
    .unwrap();
    let sent = serde_json::to_value(&server.published.lock().unwrap()[0]).unwrap();
    assert_eq!(
        sent,
        serde_json::json!({
            "description": "My Claude setup",
            "items": [{
                "kind": "skill",
                "name": "hallmark",
                "description": null,
                "source_type": "github",
                "source": "nutlope/hallmark",
                "tools": ["claude-code"],
            }],
        })
    );
}

#[test]
fn reads_a_setup_summary_only_with_a_valid_owner_and_time() {
    let raw = |owner_id| UntrustedSetup {
        owner_id,
        username: "octocat",
        avatar_url: Some("https://evil.example/pixel.png"),
        description: None,
        counts: [3, -1, 9_999],
        updated_at: "2026-11-15T10:00:00+00:00",
    };
    let summary = untrusted_setup(&raw(OWNER)).unwrap();
    assert_eq!(summary.owner.avatar_url, None, "only GitHub's avatar host");
    assert_eq!(
        (
            summary.skill_count,
            summary.mcp_server_count,
            summary.plugin_count
        ),
        (3, 0, MAX_ITEMS as u32)
    );
    assert!(untrusted_setup(&raw("not-a-uuid")).is_none());
    assert!(block_on(setup(&FakeServer::default(), "../etc")).is_err());
}
