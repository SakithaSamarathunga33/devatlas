import { z } from "zod";

import { invokeCommand } from "@/services/ipc";
import {
  setupPageSchema,
  setupPreviewSchema,
  sharedSetupSchema,
  type SetupPage,
  type SetupPreview,
  type SharedSetup,
} from "@/types/agent-setups.types";

/** The skills, MCP servers and plugins Claude Code and Codex have installed here. */
export function detectAgentSetup(): Promise<SetupPreview> {
  return invokeCommand("detect_agent_setup", setupPreviewSchema);
}

export function listSharedSetups(offset: number): Promise<SetupPage> {
  return invokeCommand("list_shared_setups", setupPageSchema, { offset });
}

/** An account's shared setup, or `null` when it hasn't shared one. */
export function getSharedSetup(ownerId: string): Promise<SharedSetup | null> {
  return invokeCommand("get_shared_setup", sharedSetupSchema.nullable(), { ownerId });
}

/** Shares the chosen items by key; the backend reads them from this computer itself. */
export function shareAgentSetup(keys: string[], description: string | null): Promise<null> {
  return invokeCommand("share_agent_setup", z.null(), { keys, description });
}

export function unshareAgentSetup(): Promise<null> {
  return invokeCommand("unshare_agent_setup", z.null());
}

/** `false` when this account had already reported the setup. */
export function reportSharedSetup(ownerId: string, reason: string | null): Promise<boolean> {
  return invokeCommand("report_shared_setup", z.boolean(), { ownerId, reason });
}
