import { startOfMonth } from "date-fns";

import type { Resource } from "@/types/library.types";

/** One line of real numbers for the dashboard greeting. */
export function librarySummary(resources: readonly Resource[], now: Date): string {
  if (resources.length === 0) return "Save your first link with Add link";

  const monthStart = startOfMonth(now).getTime();
  const saved = resources.filter(({ addedAt }) => addedAt !== null && addedAt >= monthStart).length;
  const unreviewed = resources.filter(({ isNew }) => isNew).length;
  const parts = [
    ...(saved > 0 ? [`${String(saved)} saved this month`] : []),
    ...(unreviewed > 0 ? [`${String(unreviewed)} new to review`] : []),
  ];

  return parts.length > 0 ? parts.join(", ") : "Nothing new this month";
}
