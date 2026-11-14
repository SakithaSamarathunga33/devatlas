import { z } from "zod";

import { invokeCommand } from "@/services/ipc";
import { appInfoSchema, updateSchema, type AppInfo } from "@/types/app-info.types";
import type { RepoRelease } from "@/types/discovery.types";

/** Fetches the running application's identity from the Rust backend. */
export function getAppInfo(): Promise<AppInfo> {
  return invokeCommand("get_app_info", appInfoSchema);
}

/** The newer DevAtlas release on GitHub, or `null` when this build is up to date. */
export function checkForUpdate(): Promise<RepoRelease | null> {
  return invokeCommand("check_for_update", updateSchema);
}

/**
 * Downloads the newer release's signed update, installs it and restarts DevAtlas. The backend
 * looks the release up itself; on success this process exits before the promise settles.
 */
export async function installUpdate(): Promise<void> {
  await invokeCommand("install_update", z.null());
}
