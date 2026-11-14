import { useQuery } from "@tanstack/react-query";

import { checkForUpdate, getAppInfo } from "@/services/app-info.service";

export const appInfoQueryKey = ["app-info"] as const;

/** App identity reported by the Rust backend. Shared by the header status and the dashboard. */
export function useAppInfo() {
  return useQuery({
    queryKey: appInfoQueryKey,
    queryFn: getAppInfo,
    // The identity cannot change while the app runs, and IPC failures are not transient:
    // show the error immediately and let the user retry explicitly.
    staleTime: Infinity,
    retry: false,
  });
}

/** GitHub allows 60 unauthenticated requests an hour; a few checks a day are plenty. */
const UPDATE_CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

/** The newer DevAtlas release, checked at start and every few hours. A failure shows nothing. */
export function useUpdateCheck() {
  return useQuery({
    queryKey: ["update-check"],
    queryFn: checkForUpdate,
    staleTime: UPDATE_CHECK_EVERY_MS,
    refetchInterval: UPDATE_CHECK_EVERY_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
