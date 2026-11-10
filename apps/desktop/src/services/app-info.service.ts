import { invoke, isTauri } from "@tauri-apps/api/core";

import { appInfoSchema, type AppInfo } from "@/types/app-info.types";

const GET_APP_INFO = "get_app_info";

/** Fetches the running application's identity from the Rust backend. */
export async function getAppInfo(): Promise<AppInfo> {
  if (!isTauri()) {
    throw new Error(
      "DevAtlas is running outside the desktop app, so the Rust backend is unreachable. Start it with `pnpm dev`.",
    );
  }

  let payload: unknown;
  try {
    payload = await invoke<unknown>(GET_APP_INFO);
  } catch (cause) {
    throw new Error(`The backend command "${GET_APP_INFO}" failed: ${describeError(cause)}`, {
      cause,
    });
  }

  const result = appInfoSchema.safeParse(payload);
  if (!result.success) {
    throw new Error("The backend returned app information in an unexpected shape.", {
      cause: result.error,
    });
  }
  return result.data;
}

/** Tauri rejects with plain strings for command errors; normalize everything else. */
function describeError(cause: unknown): string {
  if (typeof cause === "string") return cause;
  if (cause instanceof Error) return cause.message;
  return "unknown error";
}
