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
  /** `browser`: a browser bookmark (managed there). `devatlas`: saved in DevAtlas. */
  origin: z.enum(["browser", "devatlas"]),
  /** Found since an earlier run and not opened yet (cleared after a week). */
  isNew: z.boolean(),
  /** The category the user chose; `null` when `category` is automatic. */
  categoryOverride: resourceCategorySchema.nullable(),
  tags: z.array(z.string()),
  note: z.string().nullable(),
});
export type Resource = z.infer<typeof resourceSchema>;

/** IPC contract for `add_link`: the saved resource, before anything is added to it. */
export const savedResourceSchema = resourceSchema.omit({
  isNew: true,
  categoryOverride: true,
  tags: true,
  note: true,
});

/** IPC contract for the Rust `list_library` command. */
export const librarySnapshotSchema = z.object({
  source: z.object({
    /** Empty when no browser is selected. */
    browser: z.string(),
    folder: z.string(),
    /** Why the browser's bookmarks couldn't be read, if they couldn't. */
    warning: z.string().nullable(),
  }),
  resources: z.array(resourceSchema),
});
export type LibrarySnapshot = z.infer<typeof librarySnapshotSchema>;
