import { z } from "zod";

import { repoReleaseSchema } from "@/types/discovery.types";

/**
 * IPC contract for the Rust `get_app_info` command.
 * Mirrors `devatlas_application::app_info::AppInfo`; keep both in sync.
 */
export const appInfoSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  platform: z.string().min(1),
});

export type AppInfo = z.infer<typeof appInfoSchema>;

/** IPC contract for `check_for_update`: the newer DevAtlas release, or `null` when up to date. */
export const updateSchema = repoReleaseSchema.nullable();
