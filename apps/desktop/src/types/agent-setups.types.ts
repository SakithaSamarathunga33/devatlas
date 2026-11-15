import { z } from "zod";

import { sharedLinkSchema } from "@/types/community.types";

const httpsUrl = z.url({ protocol: /^https$/ });

export const setupKinds = ["skill", "mcp-server", "plugin"] as const;
export const setupKindSchema = z.enum(setupKinds);
export type SetupKind = z.infer<typeof setupKindSchema>;

export const setupToolSchema = z.enum(["claude-code", "codex"]);
export type SetupTool = z.infer<typeof setupToolSchema>;

/** Mirrors `devatlas_application::agent_setups::SetupEntry`. */
export const setupEntrySchema = z.object({
  kind: setupKindSchema,
  name: z.string().min(1),
  description: z.string().nullable(),
  source: z.object({ type: z.enum(["github", "npm", "pypi"]), id: z.string().min(1) }).nullable(),
  tools: z.array(setupToolSchema).min(1),
  /** Picks the item when sharing: `kind:name`. */
  key: z.string().min(1),
  link: sharedLinkSchema.nullable(),
  /** Built by DevAtlas from checked fields; `tool` is `null` when any agent can run it. */
  install: z.array(z.object({ tool: setupToolSchema.nullable(), command: z.string().min(1) })),
});
export type SetupEntry = z.infer<typeof setupEntrySchema>;

/** Mirrors `devatlas_application::agent_setups::SetupPreview`. */
export const setupPreviewSchema = z.object({
  items: z.array(setupEntrySchema),
  skipped: z.number().int().nonnegative(),
});
export type SetupPreview = z.infer<typeof setupPreviewSchema>;

/** Mirrors `devatlas_application::agent_setups::SetupSummary`; a setup goes by its owner's id. */
export const setupSummarySchema = z.object({
  owner: z.object({
    id: z.string().min(1),
    username: z.string().min(1),
    avatarUrl: httpsUrl.nullable(),
  }),
  description: z.string().nullable(),
  skillCount: z.number().int().nonnegative(),
  mcpServerCount: z.number().int().nonnegative(),
  pluginCount: z.number().int().nonnegative(),
  updatedAt: z.string().min(1),
});
export type SetupSummary = z.infer<typeof setupSummarySchema>;

export const sharedSetupSchema = setupSummarySchema.extend({ items: z.array(setupEntrySchema) });
export type SharedSetup = z.infer<typeof sharedSetupSchema>;

export const setupPageSchema = z.object({
  setups: z.array(setupSummarySchema),
  nextOffset: z.number().int().nonnegative().nullable(),
});
export type SetupPage = z.infer<typeof setupPageSchema>;
