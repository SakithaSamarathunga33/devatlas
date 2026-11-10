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
});
export type Resource = z.infer<typeof resourceSchema>;

/** IPC contract for the Rust `list_library` command. */
export const librarySnapshotSchema = z.object({
  source: z.object({ browser: z.string(), folder: z.string() }),
  resources: z.array(resourceSchema),
});
export type LibrarySnapshot = z.infer<typeof librarySnapshotSchema>;
