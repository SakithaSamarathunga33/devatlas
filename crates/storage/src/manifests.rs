//! Reads the dependencies a project declares: `package.json`, `Cargo.toml`, `go.mod`,
//! `pyproject.toml` and `requirements.txt` in one folder, plus the `package.json` and
//! `Cargo.toml` of the workspace members it declares. Only those files are opened, only
//! dependency names leave this module, and a file that can't be parsed is skipped.

use std::collections::BTreeSet;
use std::io::ErrorKind;
use std::path::{Component, Path, PathBuf};

use devatlas_application::agent::{Dependency, Ecosystem, ProjectManifests};

/// Real manifests are far smaller; anything bigger is not one.
const MAX_MANIFEST_BYTES: u64 = 1024 * 1024;
/// Bounds what one call returns; real projects stay well under this.
const MAX_DEPENDENCIES: usize = 500;
const MAX_NAME_LEN: usize = 100;
/// Bounds how many workspace member folders one call opens.
const MAX_MEMBERS: usize = 100;

#[derive(Debug, thiserror::Error)]
pub enum ManifestError {
    #[error("{0} is not a folder")]
    NotAFolder(String),
    #[error("a manifest could not be read: {0}")]
    Io(#[from] std::io::Error),
}

pub struct ManifestReader;

impl ProjectManifests for ManifestReader {
    type Error = ManifestError;

    fn dependencies(&self, dir: &Path) -> Result<Vec<Dependency>, ManifestError> {
        if !dir.is_dir() {
            return Err(ManifestError::NotAFolder(dir.display().to_string()));
        }
        let mut found = BTreeSet::new();
        let mut add = |names: Vec<String>, ecosystem: Ecosystem| {
            for name in names.into_iter().filter(|name| name.len() <= MAX_NAME_LEN) {
                found.insert((ecosystem_order(ecosystem), name, ecosystem_name(ecosystem)));
            }
        };
        let package = read(&dir.join("package.json"))?;
        let pnpm = read(&dir.join("pnpm-workspace.yaml"))?;
        let mut npm_members = package.as_deref().map(npm_workspaces).unwrap_or_default();
        npm_members.extend(pnpm.as_deref().map(pnpm_workspaces).unwrap_or_default());
        if let Some(text) = &package {
            add(npm(text), Ecosystem::Npm);
        }
        for member in members(dir, &npm_members) {
            if let Some(text) = read(&member.join("package.json"))? {
                add(npm(&text), Ecosystem::Npm);
            }
        }
        if let Some(text) = read(&dir.join("Cargo.toml"))? {
            add(cargo(&text), Ecosystem::Cargo);
            for member in members(dir, &cargo_members(&text)) {
                if let Some(text) = read(&member.join("Cargo.toml"))? {
                    add(cargo(&text), Ecosystem::Cargo);
                }
            }
        }
        if let Some(text) = read(&dir.join("go.mod"))? {
            add(go(&text), Ecosystem::Go);
        }
        if let Some(text) = read(&dir.join("pyproject.toml"))? {
            add(pyproject(&text), Ecosystem::Python);
        }
        if let Some(text) = read(&dir.join("requirements.txt"))? {
            add(requirements(&text), Ecosystem::Python);
        }
        Ok(found
            .into_iter()
            .take(MAX_DEPENDENCIES)
            .map(|(_, name, ecosystem)| Dependency {
                name,
                ecosystem: ecosystem_from(ecosystem),
            })
            .collect())
    }
}

const fn ecosystem_order(ecosystem: Ecosystem) -> u8 {
    match ecosystem {
        Ecosystem::Npm => 0,
        Ecosystem::Cargo => 1,
        Ecosystem::Go => 2,
        Ecosystem::Python => 3,
    }
}

const fn ecosystem_name(ecosystem: Ecosystem) -> &'static str {
    match ecosystem {
        Ecosystem::Npm => "npm",
        Ecosystem::Cargo => "cargo",
        Ecosystem::Go => "go",
        Ecosystem::Python => "python",
    }
}

fn ecosystem_from(name: &str) -> Ecosystem {
    match name {
        "cargo" => Ecosystem::Cargo,
        "go" => Ecosystem::Go,
        "python" => Ecosystem::Python,
        _ => Ecosystem::Npm,
    }
}

/// The file's text; `None` when it is missing, too large to be a manifest, or a link: a
/// symlinked manifest could point anywhere, and only the project's own files are read.
fn read(path: &Path) -> Result<Option<String>, ManifestError> {
    match std::fs::symlink_metadata(path) {
        Ok(meta) if meta.is_file() && meta.len() <= MAX_MANIFEST_BYTES => {}
        Ok(_) => return Ok(None),
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.into()),
    }
    match std::fs::read_to_string(path) {
        Ok(text) => Ok(Some(text)),
        // Not UTF-8: not a manifest worth reading.
        Err(error) if error.kind() == ErrorKind::InvalidData => Ok(None),
        Err(error) => Err(error.into()),
    }
}

/// The member folders that workspace `patterns` name, inside `dir` only. A pattern is a folder
/// (`tools/cli`) or a folder's children (`apps/*`); exclusions and deeper globs are skipped.
fn members(dir: &Path, patterns: &[String]) -> Vec<PathBuf> {
    let Ok(root) = dir.canonicalize() else {
        return Vec::new();
    };
    // A folder whose real location is inside the project: a link anywhere along the way
    // (symlink or junction) could otherwise lead out of it.
    let is_folder = |path: &Path| {
        path.canonicalize()
            .is_ok_and(|real| real.starts_with(&root) && real.is_dir())
    };
    let mut found = BTreeSet::new();
    for pattern in patterns
        .iter()
        .take(MAX_MEMBERS)
        .map(|p| p.trim().trim_end_matches('/'))
    {
        if found.len() >= MAX_MEMBERS {
            break;
        }
        let (base, children) = match pattern.strip_suffix("/*") {
            Some(base) => (base, true),
            None => (pattern, false),
        };
        let relative = Path::new(base);
        let inside = relative
            .components()
            .all(|part| matches!(part, Component::Normal(_) | Component::CurDir));
        if base.is_empty() || pattern.starts_with('!') || base.contains('*') || !inside {
            continue;
        }
        let path = dir.join(relative);
        if !is_folder(&path) {
            continue;
        }
        if !children {
            found.insert(path);
            continue;
        }
        let Ok(entries) = std::fs::read_dir(&path) else {
            continue;
        };
        found.extend(
            entries
                .flatten()
                .take(MAX_MEMBERS)
                .map(|entry| entry.path())
                .filter(|child| is_folder(child)),
        );
    }
    found.into_iter().take(MAX_MEMBERS).collect()
}

/// `workspaces` in a package.json, as a list or as `{ "packages": [...] }` (Yarn).
fn npm_workspaces(text: &str) -> Vec<String> {
    let Ok(json) = serde_json::from_str::<serde_json::Value>(text) else {
        return Vec::new();
    };
    let list = json
        .get("workspaces")
        .map(|w| w.get("packages").unwrap_or(w));
    string_list(list.and_then(serde_json::Value::as_array))
}

fn string_list(values: Option<&Vec<serde_json::Value>>) -> Vec<String> {
    values
        .map(|values| {
            values
                .iter()
                .filter_map(|v| v.as_str().map(str::to_owned))
                .collect()
        })
        .unwrap_or_default()
}

/// The `packages:` list of a pnpm-workspace.yaml. ponytail: reads only the plain
/// `- "pattern"` list form pnpm documents; a flow list (`[a, b]`) needs a YAML parser.
fn pnpm_workspaces(text: &str) -> Vec<String> {
    let mut in_packages = false;
    let mut patterns = Vec::new();
    for line in text.trim_start_matches('\u{FEFF}').lines() {
        // Comments: whole-line, or trailing after a space.
        let line = line.split(" #").next().unwrap_or(line);
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        if !line.starts_with([' ', '\t', '-']) {
            in_packages = trimmed == "packages:";
        } else if let Some(item) = trimmed.strip_prefix('-').filter(|_| in_packages) {
            patterns.push(item.trim().trim_matches(['"', '\'']).to_owned());
        }
    }
    patterns
}

/// `members` of a Cargo `[workspace]`.
fn cargo_members(text: &str) -> Vec<String> {
    let Ok(manifest) = text.parse::<toml::Table>() else {
        return Vec::new();
    };
    manifest
        .get("workspace")
        .and_then(|workspace| workspace.get("members"))
        .and_then(toml::Value::as_array)
        .map(|members| {
            members
                .iter()
                .filter_map(|m| m.as_str().map(str::to_owned))
                .collect()
        })
        .unwrap_or_default()
}

fn object_keys(value: Option<&serde_json::Value>) -> Vec<String> {
    value
        .and_then(serde_json::Value::as_object)
        .map(|object| object.keys().cloned().collect())
        .unwrap_or_default()
}

fn npm(text: &str) -> Vec<String> {
    let Ok(json) = serde_json::from_str::<serde_json::Value>(text) else {
        tracing::warn!("package.json could not be parsed");
        return Vec::new();
    };
    ["dependencies", "devDependencies", "peerDependencies"]
        .iter()
        .flat_map(|section| object_keys(json.get(section)))
        .collect()
}

fn table_keys(value: Option<&toml::Value>) -> Vec<String> {
    value
        .and_then(toml::Value::as_table)
        .map(|table| table.keys().cloned().collect())
        .unwrap_or_default()
}

fn cargo(text: &str) -> Vec<String> {
    let Ok(manifest) = text.parse::<toml::Table>() else {
        tracing::warn!("Cargo.toml could not be parsed");
        return Vec::new();
    };
    let workspace = manifest
        .get("workspace")
        .and_then(|value| value.get("dependencies"));
    ["dependencies", "dev-dependencies", "build-dependencies"]
        .iter()
        .flat_map(|section| table_keys(manifest.get(*section)))
        .chain(table_keys(workspace))
        .collect()
}

fn go(text: &str) -> Vec<String> {
    let mut in_block = false;
    let mut modules = Vec::new();
    for line in text.lines().map(str::trim) {
        if line.starts_with("require (") {
            in_block = true;
        } else if in_block && line.starts_with(')') {
            in_block = false;
        } else if let Some(single) = line.strip_prefix("require ") {
            modules.extend(single.split_whitespace().next().map(str::to_owned));
        } else if in_block && !line.is_empty() && !line.starts_with("//") {
            modules.extend(line.split_whitespace().next().map(str::to_owned));
        }
    }
    modules
}

/// The distribution name of a PEP 508 requirement such as `fastapi[all]>=0.110; python_version>"3"`.
fn requirement_name(spec: &str) -> Option<String> {
    let name: String = spec
        .trim()
        .chars()
        .take_while(|c| c.is_alphanumeric() || matches!(c, '-' | '_' | '.'))
        .collect();
    (!name.is_empty()).then(|| name.to_lowercase())
}

fn pyproject(text: &str) -> Vec<String> {
    let Ok(manifest) = text.parse::<toml::Table>() else {
        tracing::warn!("pyproject.toml could not be parsed");
        return Vec::new();
    };
    let pep621 = manifest
        .get("project")
        .and_then(|project| project.get("dependencies"))
        .and_then(toml::Value::as_array)
        .map(|specs| {
            specs
                .iter()
                .filter_map(toml::Value::as_str)
                .filter_map(requirement_name)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let poetry = manifest
        .get("tool")
        .and_then(|tool| tool.get("poetry"))
        .and_then(|poetry| poetry.get("dependencies"));
    pep621
        .into_iter()
        .chain(
            table_keys(poetry)
                .into_iter()
                .filter(|name| name != "python"),
        )
        .collect()
}

fn requirements(text: &str) -> Vec<String> {
    text.lines()
        .map(str::trim)
        // Options, comments, local paths and direct URLs name no package.
        .filter(|line| {
            !line.is_empty() && !line.starts_with(['#', '-', '.', '/']) && !line.contains("://")
        })
        .filter_map(requirement_name)
        .collect()
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::*;

    fn project(name: &str, files: &[(&str, &str)]) -> PathBuf {
        let dir = std::env::temp_dir()
            .join(format!("devatlas-manifests-{}", std::process::id()))
            .join(name);
        std::fs::create_dir_all(&dir).unwrap();
        for (file, text) in files {
            std::fs::write(dir.join(file), text).unwrap();
        }
        dir
    }

    fn names(dir: &Path) -> Vec<String> {
        ManifestReader
            .dependencies(dir)
            .unwrap()
            .into_iter()
            .map(|dependency| format!("{:?}:{}", dependency.ecosystem, dependency.name))
            .collect()
    }

    #[test]
    fn reads_every_supported_manifest() {
        let dir = project(
            "all",
            &[
                (
                    "package.json",
                    r#"{"dependencies":{"react":"19"},"devDependencies":{"vite":"8"}}"#,
                ),
                (
                    "Cargo.toml",
                    "[dependencies]\ntokio = \"1\"\n[workspace.dependencies]\nserde = \"1\"\n",
                ),
                (
                    "go.mod",
                    "module x\n\nrequire github.com/a/b v1\nrequire (\n\tgithub.com/gin-gonic/gin v1.9 // indirect\n)\n",
                ),
                (
                    "pyproject.toml",
                    "[project]\ndependencies = [\"FastAPI[all]>=0.110\"]\n[tool.poetry.dependencies]\npython = \"^3.12\"\nrich = \"*\"\n",
                ),
                (
                    "requirements.txt",
                    "# comment\n-r base.txt\nrequests==2.32\n",
                ),
            ],
        );

        assert_eq!(
            names(&dir),
            [
                "Npm:react",
                "Npm:vite",
                "Cargo:serde",
                "Cargo:tokio",
                "Go:github.com/a/b",
                "Go:github.com/gin-gonic/gin",
                "Python:fastapi",
                "Python:requests",
                "Python:rich",
            ]
        );
    }

    #[test]
    fn skips_a_broken_manifest_and_keeps_the_rest() {
        let dir = project(
            "broken",
            &[
                ("package.json", "{ not json"),
                ("Cargo.toml", "[dependencies]\nanyhow = \"1\"\n"),
            ],
        );

        assert_eq!(names(&dir), ["Cargo:anyhow"]);
    }

    #[test]
    fn refuses_a_path_that_is_not_a_folder() {
        let dir = project("file", &[("package.json", "{}")]);

        assert!(matches!(
            ManifestReader.dependencies(&dir.join("package.json")),
            Err(ManifestError::NotAFolder(_))
        ));
    }

    #[test]
    fn requirements_skip_urls_paths_and_options() {
        let dir = project(
            "urls",
            &[(
                "requirements.txt",
                "-e .\nhttps://x.example/pkg.whl\ngit+https://x/y.git\n./local\n/abs\nflask>=3\n",
            )],
        );

        assert_eq!(names(&dir), ["Python:flask"]);
    }

    #[test]
    fn caps_how_many_and_how_long() {
        let many: String = (0..600).map(|n| format!("pkg{n}\n")).collect();
        let long = format!("{}\n", "x".repeat(MAX_NAME_LEN + 1));
        let dir = project("caps", &[("requirements.txt", &format!("{long}{many}"))]);

        let found = names(&dir);

        assert_eq!(found.len(), MAX_DEPENDENCIES);
        assert!(
            found
                .iter()
                .all(|name| name.len() <= MAX_NAME_LEN + "Python:".len())
        );
    }

    #[cfg(unix)]
    #[test]
    fn never_follows_a_symlinked_manifest() {
        let dir = project("link", &[]);
        let secret = dir.join("secret.txt");
        std::fs::write(&secret, "token-abc\n").unwrap();
        std::os::unix::fs::symlink(&secret, dir.join("requirements.txt")).unwrap();

        assert!(names(&dir).is_empty());
    }

    #[test]
    fn reads_the_workspace_members_a_root_declares() {
        let dir = project(
            "workspace",
            &[
                ("package.json", r#"{"workspaces":["tools/cli"]}"#),
                (
                    "pnpm-workspace.yaml",
                    "\u{FEFF}packages: # members\n# apps first\n  - \"apps/*\" # web\n  - '!apps/skip'\n",
                ),
                ("Cargo.toml", "[workspace]\nmembers = [\"crates/*\"]\n"),
            ],
        );
        for (member, file, text) in [
            (
                "apps/web",
                "package.json",
                r#"{"dependencies":{"react":"19"}}"#,
            ),
            (
                "tools/cli",
                "package.json",
                r#"{"dependencies":{"commander":"14"}}"#,
            ),
            (
                "crates/core",
                "Cargo.toml",
                "[dependencies]\nregex = \"1\"\n",
            ),
        ] {
            std::fs::create_dir_all(dir.join(member)).unwrap();
            std::fs::write(dir.join(member).join(file), text).unwrap();
        }

        assert_eq!(names(&dir), ["Npm:commander", "Npm:react", "Cargo:regex"]);
    }

    #[test]
    fn workspace_members_stay_inside_the_folder() {
        let root = project("escape", &[]);
        let outside = root.join("outside");
        std::fs::create_dir_all(&outside).unwrap();
        std::fs::write(
            outside.join("package.json"),
            r#"{"dependencies":{"leak":"1"}}"#,
        )
        .unwrap();
        let dir = root.join("inner");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(
            dir.join("package.json"),
            r#"{"workspaces":["../outside", "/abs"]}"#,
        )
        .unwrap();

        assert!(names(&dir).is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn workspace_members_never_pass_through_a_linked_folder() {
        let root = project("middle-link", &[]);
        let outside = root.join("outside/pkg");
        std::fs::create_dir_all(&outside).unwrap();
        std::fs::write(
            outside.join("package.json"),
            r#"{"dependencies":{"leak":"1"}}"#,
        )
        .unwrap();
        let dir = root.join("inner");
        std::fs::create_dir_all(&dir).unwrap();
        std::os::unix::fs::symlink(root.join("outside"), dir.join("link")).unwrap();
        std::fs::write(
            dir.join("package.json"),
            r#"{"workspaces":["link/pkg", "link/*"]}"#,
        )
        .unwrap();

        assert!(names(&dir).is_empty());
    }

    #[test]
    fn an_empty_folder_has_no_dependencies() {
        assert!(names(&project("empty", &[])).is_empty());
    }
}
