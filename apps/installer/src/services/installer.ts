import { Channel, invoke, isTauri, type InvokeArgs } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import { z } from "zod";

/** Mirrors `commands::InstallDefaults` in src-tauri. */
export const installDefaultsSchema = z.object({
  dir: z.string().min(1),
  requiredBytes: z.number().int().nonnegative(),
  version: z.string().min(1),
});
export type InstallDefaults = z.infer<typeof installDefaultsSchema>;

/** Mirrors `install::Progress`. Steps arrive in this order. */
export const INSTALL_STEPS = ["preparing", "extracting", "configuring", "finalizing"] as const;
export const progressSchema = z.object({
  step: z.enum(INSTALL_STEPS),
  percent: z.number().int().min(0).max(100),
});
export type InstallProgress = z.infer<typeof progressSchema>;

export interface InstallOptions {
  dir: string;
  desktopShortcut: boolean;
  startMenuShortcut: boolean;
}

async function invokeCommand<T>(command: string, schema: z.ZodType<T>, args?: InvokeArgs) {
  if (!isTauri()) {
    throw new Error(
      "DevAtlas Setup must run as the desktop installer. Start it with `pnpm tauri dev`.",
    );
  }
  let payload: unknown;
  try {
    payload = await invoke<unknown>(command, args);
  } catch (cause) {
    // Tauri rejects command errors with the plain message string.
    throw new Error(typeof cause === "string" ? cause : `Setup step "${command}" failed.`, {
      cause,
    });
  }
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new Error(`Setup step "${command}" returned unexpected data.`, { cause: result.error });
  }
  return result.data;
}

export function getInstallDefaults(): Promise<InstallDefaults> {
  return invokeCommand("get_install_defaults", installDefaultsSchema);
}

/** Free bytes on the drive for `dir`, or `null` when it cannot be measured. */
export function getAvailableSpace(dir: string): Promise<number | null> {
  return invokeCommand("get_available_space", z.number().nonnegative().nullable(), { dir });
}

export async function install(
  options: InstallOptions,
  onProgress: (progress: InstallProgress) => void,
): Promise<void> {
  const channel = new Channel<unknown>((message) => {
    const progress = progressSchema.safeParse(message);
    if (progress.success) onProgress(progress.data);
    else console.warn("Ignoring malformed install progress", message);
  });
  await invokeCommand("install", z.null(), { options, onProgress: channel });
}

export async function launchApp(): Promise<void> {
  await invokeCommand("launch_app", z.null());
}

/** Opens the folder picker; resolves to the chosen folder or `null` when cancelled. */
export async function pickFolder(defaultPath: string): Promise<string | null> {
  const picked = await open({ directory: true, defaultPath, title: "Choose where to install" });
  return typeof picked === "string" ? picked : null;
}

export async function minimizeWindow(): Promise<void> {
  await getCurrentWindow().minimize();
}

export async function closeWindow(): Promise<void> {
  await getCurrentWindow().close();
}
