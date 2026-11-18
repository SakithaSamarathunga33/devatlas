import { z } from "zod";

/** Mirrors `devatlas_application::library_sync::SyncStatus`. */
export const syncStatusSchema = z.discriminatedUnion("state", [
  /** Sync goes through the Community account. */
  z.object({ state: z.literal("signedOut") }),
  /** Not set up for this account on any computer yet. */
  z.object({ state: z.literal("off") }),
  /** Set up on another computer; this one needs the passphrase. */
  z.object({ state: z.literal("needsPassphrase") }),
  z.object({ state: z.literal("on"), syncedAt: z.number().int().nullable() }),
]);
export type SyncStatus = z.infer<typeof syncStatusSchema>;

/** Mirrors `devatlas_application::library_sync::SyncReport`. */
export const syncReportSchema = z.object({
  /** Whether this computer's library changed. */
  changed: z.boolean(),
  syncedAt: z.number().int(),
});
export type SyncReport = z.infer<typeof syncReportSchema>;
