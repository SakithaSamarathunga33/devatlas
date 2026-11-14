import { useQuery } from "@tanstack/react-query";

import { checkForUpdate } from "@/services/app-info.service";

/**
 * Each check reads a github.com redirect that costs no API request, so it can run often. Only
 * finding a newer release spends one, and then checking stops: the update is already shown.
 */
const UPDATE_CHECK_EVERY_MS = 5 * 60 * 1000;

/** The newer DevAtlas release, checked at start, every few minutes and on returning to the app. */
export function useUpdateCheck() {
  return useQuery({
    queryKey: ["update-check"],
    queryFn: checkForUpdate,
    staleTime: 60 * 1000,
    refetchInterval: (query) => (query.state.data ? false : UPDATE_CHECK_EVERY_MS),
    refetchOnWindowFocus: (query) => !query.state.data,
    retry: false,
  });
}
