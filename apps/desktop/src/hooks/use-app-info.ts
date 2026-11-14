import { useQuery } from "@tanstack/react-query";

import { checkForUpdate } from "@/services/app-info.service";

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
