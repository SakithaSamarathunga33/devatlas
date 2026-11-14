import { describeError } from "@/services/ipc";

/** A backend failure as the user should read it, without the IPC wrapper text. */
export function errorMessage(error: unknown): string {
  return describeError(error).replace(/^.*?failed: /, "");
}
