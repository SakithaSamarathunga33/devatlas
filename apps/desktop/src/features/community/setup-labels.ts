import type { SetupEntry, SetupKind, SetupTool } from "@/types/agent-setups.types";

export const KIND_LABELS: Record<SetupKind, { one: string; many: string }> = {
  skill: { one: "skill", many: "Skills" },
  "mcp-server": { one: "MCP server", many: "MCP servers" },
  plugin: { one: "plugin", many: "Plugins" },
};

export const TOOL_LABELS: Record<SetupTool, string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
};

/** Where an item comes from, as plain text. */
export function sourceLabel(entry: SetupEntry): string {
  const source = entry.source;
  if (source === null) return "No public source: installed from this computer";
  switch (source.type) {
    case "github":
      return `github.com/${source.id}`;
    case "npm":
      return `npm · ${source.id}`;
    case "pypi":
      return `PyPI · ${source.id}`;
  }
}

/** "12 skills · 3 MCP servers · 1 plugin", leaving out kinds with none. */
export function setupCounts(counts: Record<SetupKind, number>): string {
  const parts = (Object.keys(KIND_LABELS) as SetupKind[])
    .filter((kind) => counts[kind] > 0)
    .map((kind) => {
      const count = counts[kind];
      const label = count === 1 ? KIND_LABELS[kind].one : KIND_LABELS[kind].many.toLowerCase();
      return `${String(count)} ${label}`;
    });
  return parts.length === 0 ? "Nothing shared" : parts.join(" · ");
}
