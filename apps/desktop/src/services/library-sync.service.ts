import { z } from "zod";

import { invokeCommand } from "@/services/ipc";
import {
  syncReportSchema,
  syncStatusSchema,
  type SyncReport,
  type SyncStatus,
} from "@/types/library-sync.types";

export function getLibrarySyncStatus(): Promise<SyncStatus> {
  return invokeCommand("library_sync_status", syncStatusSchema);
}

/** Turns sync on here. Rust turns the passphrase into a key; it is never stored or sent. */
export function turnOnLibrarySync(passphrase: string): Promise<SyncReport> {
  return invokeCommand("turn_on_library_sync", syncReportSchema, { passphrase });
}

/** Deletes the synced copy and starts again from this library with a new passphrase. */
export function startLibrarySyncOver(passphrase: string): Promise<SyncReport> {
  return invokeCommand("start_library_sync_over", syncReportSchema, { passphrase });
}

export function syncLibrary(): Promise<SyncReport> {
  return invokeCommand("sync_library", syncReportSchema);
}

/** Stops syncing on this computer; the library and the synced copy stay. */
export function turnOffLibrarySync(): Promise<null> {
  return invokeCommand("turn_off_library_sync", z.null());
}
