import { useQuery } from "@tanstack/react-query";

import { getAppInfo } from "@/services/app-info.service";

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
