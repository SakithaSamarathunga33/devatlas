import { type QueryClient, useQuery } from "@tanstack/react-query";

import { useCommunitySession } from "@/features/community";
import { groupsQueryKey } from "@/hooks/use-groups";
import { libraryQueryKey } from "@/hooks/use-library";
import { snippetsQueryKey } from "@/hooks/use-snippets";
import { getLibrarySyncStatus, syncLibrary } from "@/services/library-sync.service";

export const syncStatusQueryKey = ["library-sync", "status"] as const;
/** The last automatic or requested sync; refetching it syncs. */
export const syncRunQueryKey = ["library-sync", "run"] as const;
/** Pulls changes from other computers this often while the app is open. */
export const SYNC_EVERY_MS = 10 * 60 * 1000;

/** Whether sync is on; asked again whenever the signed-in account changes. */
export function useLibrarySyncStatus() {
  const session = useCommunitySession();
  return useQuery({
    queryKey: [...syncStatusQueryKey, session.data?.id ?? null],
    queryFn: getLibrarySyncStatus,
    enabled: !session.isPending,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * The sync itself, per account, so another account starts with a fresh sync. Only the
 * app-wide runner enables it; Settings watches its result.
 */
export function useLibrarySyncRun(isEnabled: boolean) {
  const session = useCommunitySession();
  return useQuery({
    queryKey: [...syncRunQueryKey, session.data?.id ?? null],
    queryFn: syncLibrary,
    enabled: isEnabled,
    staleTime: SYNC_EVERY_MS,
    refetchInterval: isEnabled ? SYNC_EVERY_MS : false,
    // "While the app is open" includes a minimized window.
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/** What a sync can change: the library, collections and snippets. */
const SYNCED_QUERY_KEYS = [libraryQueryKey, groupsQueryKey, snippetsQueryKey];

/** After a sync changed this computer's library, shows the new one. */
export function refreshAfterSync(queryClient: QueryClient) {
  for (const queryKey of SYNCED_QUERY_KEYS) void queryClient.invalidateQueries({ queryKey });
}
