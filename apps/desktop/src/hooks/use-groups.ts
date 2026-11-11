import { useQuery } from "@tanstack/react-query";

import { listGroups } from "@/services/organizer.service";

export const groupsQueryKey = ["groups"] as const;

/** Every collection. */
export function useGroups() {
  return useQuery({ queryKey: groupsQueryKey, queryFn: listGroups, retry: false });
}
