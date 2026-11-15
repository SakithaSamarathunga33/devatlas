import type { SetupEntry, SetupPreview, SharedSetup } from "@/types/agent-setups.types";

import { OWNER_ID } from "./community.test-data";

export const HALLMARK: SetupEntry = {
  kind: "skill",
  name: "hallmark",
  description: "Designs pages that look designed.",
  source: { type: "github", id: "nutlope/hallmark" },
  tools: ["claude-code"],
  key: "skill:hallmark",
  link: {
    url: "https://github.com/nutlope/hallmark",
    title: "hallmark",
    host: "github.com",
    libraryId: "github.com/nutlope/hallmark",
  },
  install: [{ tool: null, command: "npx skills add nutlope/hallmark --skill hallmark" }],
};

export const GITHUB_MCP: SetupEntry = {
  kind: "mcp-server",
  name: "github",
  description: null,
  source: { type: "npm", id: "@modelcontextprotocol/server-github" },
  tools: ["claude-code", "codex"],
  key: "mcp-server:github",
  link: {
    url: "https://www.npmjs.com/package/@modelcontextprotocol/server-github",
    title: "github",
    host: "npmjs.com",
    libraryId: "npmjs.com/package/@modelcontextprotocol/server-github",
  },
  install: [
    {
      tool: "claude-code",
      command: "claude mcp add -s user github -- npx -y @modelcontextprotocol/server-github",
    },
    {
      tool: "codex",
      command: "codex mcp add github -- npx -y @modelcontextprotocol/server-github",
    },
  ],
};

export const LOCAL_DB: SetupEntry = {
  kind: "mcp-server",
  name: "private-db",
  description: null,
  source: null,
  tools: ["codex"],
  key: "mcp-server:private-db",
  link: null,
  install: [],
};

export const SETUP: SharedSetup = {
  owner: { id: OWNER_ID, username: "octocat", avatarUrl: null },
  description: "What I run every day",
  skillCount: 1,
  mcpServerCount: 1,
  pluginCount: 0,
  updatedAt: "2026-11-15T10:00:00+00:00",
  items: [HALLMARK, GITHUB_MCP],
};

export const DETECTED: SetupPreview = { items: [HALLMARK, GITHUB_MCP, LOCAL_DB], skipped: 1 };
