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

const syncedUserSchema = z.string().min(1).nullable();

/** Whose GitHub stars are kept in sync, or `null` when syncing is off. */
export function getStarSync(): Promise<string | null> {
  return invokeCommand("get_star_sync", syncedUserSchema);
}

/** Keeps `username`'s stars in sync from now on, or stops with `null`. */
export function setStarSync(username: string | null): Promise<string | null> {
  return invokeCommand("set_star_sync", syncedUserSchema, { username });
}

/** Imports stars added since the last sync; 0 when syncing is off. */
export function syncGithubStars(): Promise<number> {
  return invokeCommand("sync_github_stars", z.number().int().nonnegative());
}
