import { openUrl } from "@tauri-apps/plugin-opener";

import { invokeCommand } from "@/services/ipc";
import { librarySnapshotSchema, type LibrarySnapshot } from "@/types/library.types";

/** Reads the developer library live from the browser bookmarks (via the Rust backend). */
export function getLibrary(): Promise<LibrarySnapshot> {
  return invokeCommand("list_library", librarySnapshotSchema);
}

/** Opens a resource in the system browser; the capability only allows http(s) URLs. */
export function openResource(url: string): Promise<void> {
  return openUrl(url);
}
