import { useQuery } from "@tanstack/react-query";

import { getLibrary } from "@/services/library.service";

export const libraryQueryKey = ["library"] as const;

/** How often Brave's bookmarks are re-read while DevAtlas is visible. */
// ponytail: polling a ~100 KB file is cheap; switch to a file watcher if libraries get large.
const POLL_INTERVAL_MS = 3_000;

/** Developer library read from Brave. Picks up links saved in the browser within seconds. */
export function useLibrary() {
  return useQuery({
    queryKey: libraryQueryKey,
    queryFn: getLibrary,
    staleTime: 2_000,
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    retry: false,
  });
}
