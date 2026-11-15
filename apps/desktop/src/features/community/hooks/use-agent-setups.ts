import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import {
  detectAgentSetup,
  getSharedSetup,
  listSharedSetups,
} from "@/services/agent-setups.service";

import { communityQueryKey } from "./use-community";

export const setupsQueryKey = [...communityQueryKey, "setups"] as const;
export const setupQueryKey = (ownerId: string) => [...setupsQueryKey, "one", ownerId] as const;

/** Shared setups, newest first, a page at a time. */
export function useSharedSetups() {
  return useInfiniteQuery({
    queryKey: [...setupsQueryKey, "list"],
    queryFn: ({ pageParam }) => listSharedSetups(pageParam),
    initialPageParam: 0,
    getNextPageParam: (page) => page.nextOffset ?? undefined,
    staleTime: 60 * 1000,
    retry: false,
  });
}

/** An account's shared setup; `null` when it hasn't shared one. */
export function useSharedSetup(ownerId: string | null) {
  return useQuery({
    queryKey: setupQueryKey(ownerId ?? ""),
    queryFn: () => getSharedSetup(ownerId ?? ""),
    enabled: ownerId !== null,
    retry: false,
  });
}

/** What this computer could share. Read fresh each time the dialog opens. */
export function useDetectedSetup() {
  return useQuery({
    queryKey: ["agent-setup", "detected"],
    queryFn: detectAgentSetup,
    gcTime: 0,
    retry: false,
  });
}
