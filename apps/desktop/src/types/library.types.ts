import { z } from "zod";

/** Mirrors `devatlas_domain::resource::ResourceCategory`, in display order. */
export const resourceCategories = [
  "ui-components",
  "inspiration",
  "animation",
  "icons",
  "tools",
  "cloud",
  "other",
] as const;

export const resourceCategorySchema = z.enum(resourceCategories);
export type ResourceCategory = z.infer<typeof resourceCategorySchema>;

/** Mirrors `devatlas_domain::resource::Resource`. */
export const resourceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  url: z.url(),
  host: z.string().min(1),
  category: resourceCategorySchema,
  folder: z.string(),
  addedAt: z.number().int().nullable(),
  /** `browser`: a Brave bookmark (managed in Brave). `devatlas`: saved in DevAtlas. */
  origin: z.enum(["browser", "devatlas"]),
  /** Found since an earlier run and not opened yet (cleared after a week). */
  isNew: z.boolean(),
});
export type Resource = z.infer<typeof resourceSchema>;

/** IPC contract for `add_link`: the saved resource (it is new by definition). */
export const savedResourceSchema = resourceSchema.omit({ isNew: true });

/** IPC contract for the Rust `list_library` command. */
export const librarySnapshotSchema = z.object({
  source: z.object({ browser: z.string(), folder: z.string() }),
  resources: z.array(resourceSchema),
});
export type LibrarySnapshot = z.infer<typeof librarySnapshotSchema>;
