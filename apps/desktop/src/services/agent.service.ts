import { z } from "zod";

import { invokeCommand } from "@/services/ipc";
import { agentConnectionSchema, type AgentConnection } from "@/types/agent.types";

/** Where DevAtlas runs from, and how often agents looked things up this week. */
export function getAgentConnection(): Promise<AgentConnection> {
  return invokeCommand("get_agent_connection", agentConnectionSchema);
}

/** Adds the repositories `username` starred on GitHub to the library; returns how many. */
export function importGithubStars(username: string): Promise<number> {
  return invokeCommand("import_github_stars", z.number().int().nonnegative(), { username });
}
