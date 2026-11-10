import { z } from "zod";

/** IPC contract for `get_resource_preview`; mirrors `devatlas_application::preview::ResourcePreview`. */
export const resourcePreviewSchema = z.object({
  image: z.url().nullable(),
  icon: z.url().nullable(),
});
export type ResourcePreview = z.infer<typeof resourcePreviewSchema>;
