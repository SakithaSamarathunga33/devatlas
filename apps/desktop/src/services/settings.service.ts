import { z } from "zod";

import { invokeCommand } from "@/services/ipc";
import {
  settingsViewSchema,
  type BookmarkSettings,
  type SettingsView,
} from "@/types/settings.types";

/** The current bookmark settings and the browsers found on this computer. */
export function getSettings(): Promise<SettingsView> {
  return invokeCommand("get_settings", settingsViewSchema);
}

export function updateSettings(settings: BookmarkSettings): Promise<SettingsView> {
  return invokeCommand("update_settings", settingsViewSchema, { settings });
}

/** Whether the first-launch welcome was answered. */
export function getOnboarded(): Promise<boolean> {
  return invokeCommand("get_onboarded", z.boolean());
}

/** Remembers that the welcome was answered (signed in, or chose to stay local). */
export function completeOnboarding(): Promise<null> {
  return invokeCommand("complete_onboarding", z.null());
}

export function setGithubToken(token: string): Promise<null> {
  return invokeCommand("set_github_token", z.null(), { token });
}

export function clearGithubToken(): Promise<null> {
  return invokeCommand("clear_github_token", z.null());
}

const linkCheckSchema = z.object({
  checked: z.number().int(),
  broken: z.number().int(),
  moved: z.number().int(),
  unknown: z.number().int(),
});

export function checkLinks(): Promise<z.infer<typeof linkCheckSchema>> {
  return invokeCommand("check_links", linkCheckSchema);
}

/** Saves a backup through a native dialog. The file name, or `null` if cancelled. */
export function exportBackup(): Promise<string | null> {
  return invokeCommand("export_backup", z.string().nullable());
}

const importSummarySchema = z
  .object({
    links: z.number().int(),
    groups: z.number().int(),
    snippets: z.number().int(),
  })
  .nullable();

/** Imports a backup or a bookmarks export through a native dialog. `null` if cancelled. */
export function importFile(): Promise<z.infer<typeof importSummarySchema>> {
  return invokeCommand("import_file", importSummarySchema);
}
