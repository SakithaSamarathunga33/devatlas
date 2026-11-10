import { invokeCommand } from "@/services/ipc";
import { appInfoSchema, type AppInfo } from "@/types/app-info.types";

/** Fetches the running application's identity from the Rust backend. */
export function getAppInfo(): Promise<AppInfo> {
  return invokeCommand("get_app_info", appInfoSchema);
}
