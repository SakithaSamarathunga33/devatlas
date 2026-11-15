//! What Claude Code and Codex have installed on this computer: skills, MCP servers and plugins.
//!
//! Read only, and only to list names, descriptions and public sources. An MCP server's
//! command, arguments, environment and headers are read just far enough to recognise a
//! public package (`npx some-package`, `uvx some-project`) and are never kept or returned.
//! A missing or unreadable file means nothing found there, not an error.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use devatlas_application::agent_setups::{
    LocalSetup, SetupItem, SetupKind, SetupSource, SetupTool,
};
use serde_json::Value;

/// Larger config files aren't read: `~/.claude.json` grows with history but stays far below.
const MAX_FILE_BYTES: u64 = 64 * 1024 * 1024;
/// Only a SKILL.md's front matter is needed.
const MAX_SKILL_BYTES: u64 = 1024 * 1024;

/// Where Claude Code and Codex keep their settings for this user.
pub struct LocalAgentSetup {
    claude_dir: PathBuf,
    claude_json: PathBuf,
    agents_dir: PathBuf,
    codex_dir: PathBuf,
}

impl LocalAgentSetup {
    /// The default places under `home`, or those `CLAUDE_CONFIG_DIR` and `CODEX_HOME` name.
    pub fn new(home: &Path) -> Self {
        let configured = |name: &str| {
            std::env::var_os(name)
                .filter(|value| !value.is_empty())
                .map(PathBuf::from)
        };
        let claude_config = configured("CLAUDE_CONFIG_DIR");
        Self {
            // With CLAUDE_CONFIG_DIR set, Claude Code keeps `.claude.json` inside it.
            claude_json: claude_config
                .as_ref()
                .map_or_else(|| home.join(".claude.json"), |dir| dir.join(".claude.json")),
            claude_dir: claude_config.unwrap_or_else(|| home.join(".claude")),
            agents_dir: home.join(".agents"),
            codex_dir: configured("CODEX_HOME").unwrap_or_else(|| home.join(".codex")),
        }
    }

    fn skills(&self) -> Vec<SetupItem> {
        let sources = skill_sources(&self.agents_dir.join(".skill-lock.json"));
        [
            (self.claude_dir.join("skills"), SetupTool::ClaudeCode),
            // Codex reads skills from both of these.
            (self.agents_dir.join("skills"), SetupTool::Codex),
            (self.codex_dir.join("skills"), SetupTool::Codex),
        ]
        .iter()
        .flat_map(|(dir, tool)| skills_in(dir, *tool, &sources))
        .collect()
    }

    fn claude_plugins(&self) -> Vec<SetupItem> {
        let plugins_dir = self.claude_dir.join("plugins");
        let Some(installed) = read_json(&plugins_dir.join("installed_plugins.json")) else {
            return Vec::new();
        };
        let marketplaces = read_json(&plugins_dir.join("known_marketplaces.json"));
        let enabled = read_json(&self.claude_dir.join("settings.json"))
            .and_then(|settings| settings.get("enabledPlugins").cloned());
        let Some(plugins) = installed.get("plugins").and_then(Value::as_object) else {
            return Vec::new();
        };
        plugins
            .iter()
            .filter(|(name, _)| {
                let off = enabled.as_ref().and_then(|map| map.get(name.as_str()));
                off.and_then(Value::as_bool) != Some(false)
            })
            .map(|(name, installs)| {
                let marketplace = name.split_once('@').map(|(_, market)| market);
                let source = marketplace
                    .and_then(|market| marketplaces.as_ref()?.get(market)?.get("source"))
                    .and_then(github_source);
                let description = installs
                    .get(0)
                    .and_then(|install| install.get("installPath")?.as_str())
                    .and_then(|path| {
                        let manifest = Path::new(path).join(".claude-plugin").join("plugin.json");
                        read_json(&manifest)?
                            .get("description")?
                            .as_str()
                            .map(str::to_owned)
                    });
                SetupItem {
                    kind: SetupKind::Plugin,
                    name: name.clone(),
                    description,
                    source,
                    tools: vec![SetupTool::ClaudeCode],
                }
            })
            .collect()
    }

    fn claude_mcp_servers(&self) -> Vec<SetupItem> {
        // User scope only: project entries name folders on this computer.
        let Some(config) = read_json(&self.claude_json) else {
            return Vec::new();
        };
        let Some(servers) = config.get("mcpServers").and_then(Value::as_object) else {
            return Vec::new();
        };
        servers
            .iter()
            .map(|(name, server)| {
                let command = server.get("command").and_then(Value::as_str);
                let args: Vec<&str> = server
                    .get("args")
                    .and_then(Value::as_array)
                    .map(|args| args.iter().filter_map(Value::as_str).collect())
                    .unwrap_or_default();
                mcp_server(name, command, &args, SetupTool::ClaudeCode)
            })
            .collect()
    }

    fn codex(&self) -> Vec<SetupItem> {
        let path = self.codex_dir.join("config.toml");
        let Some(text) = read_text(&path, MAX_FILE_BYTES) else {
            return Vec::new();
        };
        let config: toml::Table = match toml::from_str(&text) {
            Ok(config) => config,
            Err(error) => {
                tracing::warn!(%error, "couldn't read Codex's config.toml");
                return Vec::new();
            }
        };
        // Each entry on its own, so one odd entry doesn't hide the rest; `toml::Table` keeps
        // keys sorted, so the order is the same on every read.
        let table = |key: &str| config.get(key).and_then(toml::Value::as_table);
        let servers = table("mcp_servers")
            .into_iter()
            .flatten()
            .map(|(name, server)| {
                let command = server.get("command").and_then(toml::Value::as_str);
                let args: Vec<&str> = server
                    .get("args")
                    .and_then(toml::Value::as_array)
                    .map(|args| args.iter().filter_map(toml::Value::as_str).collect())
                    .unwrap_or_default();
                mcp_server(name, command, &args, SetupTool::Codex)
            });
        let plugins = table("plugins")
            .into_iter()
            .flatten()
            .filter(|(name, plugin)| {
                let enabled = plugin.get("enabled").and_then(toml::Value::as_bool);
                // ponytail: Codex's own bundled plugins (`@openai-…`) come with every install.
                enabled == Some(true) && !name.contains("@openai-")
            })
            .map(|(name, _)| SetupItem {
                kind: SetupKind::Plugin,
                name: name.clone(),
                description: None,
                source: None,
                tools: vec![SetupTool::Codex],
            });
        servers.chain(plugins).collect()
    }
}

impl LocalSetup for LocalAgentSetup {
    fn detect(&self) -> Vec<SetupItem> {
        [
            self.skills(),
            self.claude_plugins(),
            self.claude_mcp_servers(),
            self.codex(),
        ]
        .concat()
    }
}

fn read_text(path: &Path, max: u64) -> Option<String> {
    let size = std::fs::metadata(path).ok()?.len();
    if size > max {
        tracing::warn!(path = %path.display(), "skipped an agent config file that is too large");
        return None;
    }
    std::fs::read_to_string(path).ok()
}

fn read_json(path: &Path) -> Option<Value> {
    let text = read_text(path, MAX_FILE_BYTES)?;
    serde_json::from_str(&text)
        .inspect_err(|error| tracing::warn!(%error, path = %path.display(), "couldn't read an agent config file"))
        .ok()
}

/// A marketplace's source when it is a GitHub repository: `{"source": "github", "repo": …}`,
/// or a git address on github.com.
fn github_source(source: &Value) -> Option<SetupSource> {
    let repo = match source.get("source")?.as_str()? {
        "github" => source.get("repo")?.as_str()?.to_owned(),
        "git" => {
            let url = source.get("url")?.as_str()?;
            let path = url.strip_prefix("https://github.com/")?;
            path.strip_suffix(".git").unwrap_or(path).to_owned()
        }
        _ => return None,
    };
    Some(SetupSource::Github(repo))
}

/// Skill name → GitHub repository, from the `skills` CLI's lock file.
fn skill_sources(lock: &Path) -> HashMap<String, String> {
    let Some(lock) = read_json(lock) else {
        return HashMap::new();
    };
    let Some(skills) = lock.get("skills").and_then(Value::as_object) else {
        return HashMap::new();
    };
    skills
        .iter()
        .filter(|(_, entry)| entry.get("sourceType").and_then(Value::as_str) == Some("github"))
        .filter_map(|(name, entry)| Some((name.clone(), entry.get("source")?.as_str()?.to_owned())))
        .collect()
}

fn skills_in(dir: &Path, tool: SetupTool, sources: &HashMap<String, String>) -> Vec<SetupItem> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    entries
        .filter_map(Result::ok)
        .filter(|entry| !entry.file_name().to_string_lossy().starts_with('.'))
        .filter_map(|entry| {
            let text = read_text(&entry.path().join("SKILL.md"), MAX_SKILL_BYTES)?;
            let (name, description) = frontmatter(&text);
            let name = name.unwrap_or_else(|| entry.file_name().to_string_lossy().into_owned());
            Some(SetupItem {
                kind: SetupKind::Skill,
                source: sources.get(&name).cloned().map(SetupSource::Github),
                name,
                description,
                tools: vec![tool],
            })
        })
        .collect()
}

/// `name` and `description` from a SKILL.md's YAML front matter, or nothing when it has none.
/// ponytail: plain, quoted and block (`>`/`|`) scalars only; enough for SKILL.md front matter.
fn frontmatter(text: &str) -> (Option<String>, Option<String>) {
    let text = text.strip_prefix('\u{feff}').unwrap_or(text);
    let mut lines = text.lines();
    if lines.next().map(str::trim) != Some("---") {
        return (None, None);
    }
    let body: Vec<&str> = lines
        .by_ref()
        .take_while(|line| line.trim() != "---")
        .collect();
    // Unclosed: the rest is Markdown, not front matter.
    let closed = text.lines().nth(1 + body.len()).map(str::trim) == Some("---");
    if !closed {
        return (None, None);
    }
    let (mut name, mut description) = (None, None);
    let mut folding: Option<&mut Option<String>> = None;
    for line in body {
        let continues = line.starts_with([' ', '\t']) || line.trim().is_empty();
        if continues && folding.is_some() {
            if let Some(target) = folding.as_deref_mut()
                && !line.trim().is_empty()
            {
                let joined = [target.take().unwrap_or_default().as_str(), line.trim()].join(" ");
                *target = Some(joined.trim().to_owned());
            }
            continue;
        }
        folding = None;
        let Some((key, value)) = line.split_once(':') else {
            continue;
        };
        let target = match key.trim() {
            "name" => &mut name,
            "description" => &mut description,
            _ => continue,
        };
        let value = value.trim();
        if value.is_empty() || value.starts_with(['>', '|']) {
            *target = None;
            folding = Some(target);
        } else {
            *target = Some(unquoted(value).to_owned());
        }
    }
    (name, description)
}

/// `value` without one matching pair of outer quotes.
fn unquoted(value: &str) -> &str {
    ['"', '\'']
        .iter()
        .find_map(|quote| value.strip_prefix(*quote)?.strip_suffix(*quote))
        .unwrap_or(value)
}

/// An MCP server by name, with the public package it runs when that is plain to see.
fn mcp_server(name: &str, command: Option<&str>, args: &[&str], tool: SetupTool) -> SetupItem {
    SetupItem {
        kind: SetupKind::McpServer,
        name: name.to_owned(),
        description: None,
        source: command.and_then(|command| package_source(command, args)),
        tools: vec![tool],
    }
}

/// Flags that take no value, so the word after them can still be the package.
const BARE_FLAGS: [&str; 6] = ["-y", "--yes", "-q", "--quiet", "--silent", "--offline"];

/// The npm or PyPI package an `npx`, `bunx`, `pnpm dlx` or `uvx` command runs, without its
/// version; `cmd /c npx …` counts too. Any other flag before the package may take a value
/// (`uvx --python 3.12 …`), so then there's no telling which word is the package: `None`.
fn package_source(command: &str, args: &[&str]) -> Option<SetupSource> {
    let program = |text: &str| {
        Path::new(text)
            .file_stem()
            .map(|stem| stem.to_string_lossy().to_ascii_lowercase())
    };
    let mut rest = args;
    let mut runner = program(command)?;
    if runner == "cmd" {
        // `cmd /d /s /c npx …`: switches up to `/c`, then the real program.
        let at = rest.iter().position(|arg| arg.eq_ignore_ascii_case("/c"))?;
        if !rest[..at].iter().all(|arg| arg.starts_with('/')) {
            return None;
        }
        runner = program(rest.get(at + 1)?)?;
        rest = &rest[at + 2..];
    }
    if runner == "pnpm" {
        rest = rest.strip_prefix(&["dlx"])?;
    }
    let package = rest.iter().find(|word| {
        !BARE_FLAGS.contains(word) && !(word.starts_with("--") && word.contains('='))
    })?;
    if package.starts_with('-') {
        return None;
    }
    match runner.as_str() {
        "npx" | "bunx" | "pnpm" => Some(SetupSource::Npm(without_npm_version(package))),
        "uvx" => {
            let end = package
                .find(['@', '=', '[', '<', '>'])
                .unwrap_or(package.len());
            Some(SetupSource::Pypi(package[..end].to_owned()))
        }
        _ => None,
    }
}

fn without_npm_version(package: &str) -> String {
    // A scoped name's own '@' comes first.
    let search_from = usize::from(package.starts_with('@'));
    match package[search_from..].find('@') {
        Some(at) => package[..search_from + at].to_owned(),
        None => package.to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognises_public_packages_and_nothing_else() {
        let npm = |package: &str| Some(SetupSource::Npm(package.to_owned()));
        assert_eq!(
            package_source("npx", &["-y", "@modelcontextprotocol/server-github@1.2.0"]),
            npm("@modelcontextprotocol/server-github")
        );
        assert_eq!(
            package_source(
                "C:\\Windows\\cmd.exe",
                &["/c", "npx", "-y", "left-pad@latest"]
            ),
            npm("left-pad")
        );
        assert_eq!(package_source("pnpm", &["dlx", "tool"]), npm("tool"));
        assert_eq!(package_source("pnpm", &["exec", "tool"]), None);
        assert_eq!(
            package_source("cmd", &["/d", "/s", "/c", "npx", "--yes", "pkg"]),
            npm("pkg")
        );
        assert_eq!(package_source("uvx", &["--python", "3.12", "mcp-x"]), None);
        assert_eq!(package_source("npx", &["-p", "other", "pkg"]), None);
        assert_eq!(
            package_source("npx", &["--registry=https://r.example", "pkg"]),
            npm("pkg")
        );
        assert_eq!(package_source("cmd", &["/c"]), None);
        assert_eq!(
            package_source("uvx", &["mcp-server-fetch==1.0"]),
            Some(SetupSource::Pypi("mcp-server-fetch".to_owned()))
        );
        assert_eq!(package_source("C:\\Users\\me\\obscura.exe", &["mcp"]), None);
        assert_eq!(package_source("node", &["C:\\secret\\server.js"]), None);
    }

    #[test]
    fn reads_skill_front_matter() {
        let text = "---\nname: animate\ndescription: >\n  Builds an\n  animation.\nlicense: MIT\n---\n# Body";
        assert_eq!(
            frontmatter(text),
            (
                Some("animate".to_owned()),
                Some("Builds an animation.".to_owned())
            )
        );
        assert_eq!(frontmatter("# No front matter"), (None, None));
        assert_eq!(
            frontmatter("\u{feff}---\nname: bom\ndescription: |+\n  One\n\n  Two\n---"),
            (Some("bom".to_owned()), Some("One Two".to_owned()))
        );
        assert_eq!(
            frontmatter("---\ndescription: \"Use 'foo'\"\n---"),
            (None, Some("Use 'foo'".to_owned()))
        );
        assert_eq!(frontmatter("---\nname: never closed\n# Body"), (None, None));
        assert_eq!(
            frontmatter("---\nname: 'quoted'\ndescription: \"Says hi\"\n---"),
            (Some("quoted".to_owned()), Some("Says hi".to_owned()))
        );
    }

    #[test]
    fn finds_skills_plugins_and_servers_but_keeps_no_secrets() {
        let home =
            std::env::temp_dir().join(format!("devatlas-local-setup-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&home);
        let write = |path: &str, text: &str| {
            let path = home.join(path);
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            std::fs::write(path, text).unwrap();
        };
        write(
            ".claude/skills/hallmark/SKILL.md",
            "---\nname: hallmark\ndescription: Design.\n---",
        );
        write(
            ".agents/.skill-lock.json",
            r#"{"skills":{"hallmark":{"source":"nutlope/hallmark","sourceType":"github"}}}"#,
        );
        write(
            ".claude/plugins/installed_plugins.json",
            r#"{"plugins":{"ponytail@ponytail":[{"installPath":"/nowhere"}],"off@ponytail":[{}]}}"#,
        );
        write(
            ".claude/plugins/known_marketplaces.json",
            r#"{"ponytail":{"source":{"source":"github","repo":"DietrichGebert/ponytail"}}}"#,
        );
        write(
            ".claude/settings.json",
            r#"{"enabledPlugins":{"off@ponytail":false}}"#,
        );
        write(
            ".claude.json",
            r#"{"mcpServers":{"github":{"command":"npx","args":["-y","@modelcontextprotocol/server-github"],"env":{"GITHUB_TOKEN":"ghp_secret"}}}}"#,
        );
        write(
            ".codex/config.toml",
            "[mcp_servers.db]\ncommand = \"C:/tools/db.exe\"\nenv = { PASSWORD = \"hunter2\" }\n\n[plugins.\"browser@openai-bundled\"]\nenabled = true\n",
        );

        let setup = LocalAgentSetup {
            claude_dir: home.join(".claude"),
            claude_json: home.join(".claude.json"),
            agents_dir: home.join(".agents"),
            codex_dir: home.join(".codex"),
        };
        let found = setup.detect();
        std::fs::remove_dir_all(&home).unwrap();

        let names: Vec<&str> = found.iter().map(|item| item.name.as_str()).collect();
        assert_eq!(names, ["hallmark", "ponytail@ponytail", "github", "db"]);
        assert_eq!(
            found[0].source,
            Some(SetupSource::Github("nutlope/hallmark".to_owned()))
        );
        assert_eq!(found[0].description.as_deref(), Some("Design."));
        assert_eq!(
            found[1].source,
            Some(SetupSource::Github("DietrichGebert/ponytail".to_owned()))
        );
        assert_eq!(
            found[3].source, None,
            "a local program has no public source"
        );
        let everything = format!("{found:?}");
        for secret in ["ghp_secret", "hunter2", "C:/tools", "GITHUB_TOKEN"] {
            assert!(!everything.contains(secret), "{secret} leaked");
        }
    }
}
