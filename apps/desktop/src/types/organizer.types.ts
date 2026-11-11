import { z } from "zod";

import type { ReadingStatus, ResourceCategory } from "./library.types";

/** Mirrors `devatlas_application::organizer::Group`. */
export const groupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  resourceIds: z.array(z.string()),
  createdAt: z.number().int(),
});
export type Group = z.infer<typeof groupSchema>;

export const groupsSchema = z.array(groupSchema);

/** Mirrors `devatlas_application::organizer::ResourceEdit`. */
export interface ResourceEdit {
  /** `null` keeps the automatic category. */
  category: ResourceCategory | null;
  status: ReadingStatus | null;
  tags: string[];
  note: string | null;
  /** Every group the link belongs to after this edit. */
  groupIds: string[];
}
