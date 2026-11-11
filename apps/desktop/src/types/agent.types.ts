import { z } from "zod";

/** Mirrors `devatlas_application::agent::AgentUsage`. */
export const agentUsageSchema = z.object({
  lookups: z.number().int().nonnegative(),
  lastAt: z.number().int().nullable(),
});

/** Mirrors the desktop's `AgentConnection`: how to start DevAtlas as an MCP server. */
export const agentConnectionSchema = z.object({
  executable: z.string().min(1),
  usage: agentUsageSchema,
});
export type AgentConnection = z.infer<typeof agentConnectionSchema>;
