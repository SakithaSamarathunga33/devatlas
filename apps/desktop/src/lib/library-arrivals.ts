import type { Resource } from "@/types/library.types";

/**
 * New resources that were not new in the previous snapshot. With no previous snapshot
 * (first load), every new resource counts, so links saved while DevAtlas was closed are
 * announced too.
 */
export function findArrivals(
  previousNewIds: ReadonlySet<string> | null,
  resources: readonly Resource[],
): Resource[] {
  return resources.filter(
    (resource) => resource.isNew && !(previousNewIds?.has(resource.id) ?? false),
  );
}
