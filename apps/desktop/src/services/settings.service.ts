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
