import { openUrl } from "@tauri-apps/plugin-opener";
import { z } from "zod";

import { invokeCommand } from "@/services/ipc";
import {
  librarySnapshotSchema,
  savedResourceSchema,
  type LibrarySnapshot,
} from "@/types/library.types";
import { resourcePreviewSchema, type ResourcePreview } from "@/types/preview.types";

/** Reads the developer library live from the browser bookmarks (via the Rust backend). */
export function getLibrary(): Promise<LibrarySnapshot> {
  return invokeCommand("list_library", librarySnapshotSchema);
}

/** Saves a link in DevAtlas; the backend fetches its title and preview first. */
export function addLink(url: string): Promise<z.infer<typeof savedResourceSchema>> {
  return invokeCommand("add_link", savedResourceSchema, { url });
}

/** Removes a link saved in DevAtlas (Brave bookmarks are never modified). */
export function removeLink(id: string): Promise<boolean> {
  return invokeCommand("remove_link", z.boolean(), { id });
}

/** Clears a resource's "new" mark. */
export function markResourceOpened(id: string): Promise<null> {
  return invokeCommand("mark_resource_opened", z.null(), { id });
}

/** Preview image and icon for a resource, fetched and cached by the Rust backend. */
export function getResourcePreview(url: string): Promise<ResourcePreview> {
  return invokeCommand("get_resource_preview", resourcePreviewSchema, { url });
}

/** Opens a resource in the system browser; the capability only allows http(s) URLs. */
export function openInBrowser(url: string): Promise<void> {
  return openUrl(url);
}
