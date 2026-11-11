import { z } from "zod";

const browserSchema = z.enum(["brave", "chrome", "edge", "vivaldi", "opera", "operagx", "firefox"]);

const bookmarkSettingsSchema = z.object({
  /** `null`: read no browser; the library holds only links added in DevAtlas. */
  browser: browserSchema.nullable(),
  profile: z.string(),
  folder: z.string(),
});
export type BookmarkSettings = z.infer<typeof bookmarkSettingsSchema>;

/** IPC contract for `get_settings` and `update_settings`; mirrors
 * `devatlas_application::settings::SettingsView`. */
export const settingsViewSchema = z.object({
  /** Whether a GitHub token is stored; the token itself never reaches the UI. */
  hasGithubToken: z.boolean(),
  settings: bookmarkSettingsSchema,
  options: z.array(
    z.object({
      browser: browserSchema,
      label: z.string().min(1),
      profiles: z.array(
        z.object({
          id: z.string().min(1),
          name: z.string().min(1),
          folders: z.array(z.string()),
        }),
      ),
    }),
  ),
});
export type SettingsView = z.infer<typeof settingsViewSchema>;
