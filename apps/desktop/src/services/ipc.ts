import { invoke, isTauri, type InvokeArgs } from "@tauri-apps/api/core";
import type { z } from "zod";

/** Invokes a Rust command and validates its response. All backend IPC goes through here. */
export async function invokeCommand<T>(
  command: string,
  schema: z.ZodType<T>,
  args?: InvokeArgs,
): Promise<T> {
  if (!isTauri()) {
    throw new Error(
      "DevAtlas is running outside the desktop app, so the Rust backend is unreachable. Start it with `pnpm dev`.",
    );
  }

  let payload: unknown;
  try {
    payload = await (args === undefined
      ? invoke<unknown>(command)
      : invoke<unknown>(command, args));
  } catch (cause) {
    throw new Error(`The backend command "${command}" failed: ${describeError(cause)}`, { cause });
  }

  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new Error(`The backend command "${command}" returned data in an unexpected shape.`, {
      cause: result.error,
    });
  }
  return result.data;
}

/** Message for any thrown value; Tauri rejects with plain strings for command errors. */
export function describeError(cause: unknown): string {
  if (typeof cause === "string") return cause;
  if (cause instanceof Error) return cause.message;
  return "unknown error";
}
