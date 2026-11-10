import { z } from "zod";

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
