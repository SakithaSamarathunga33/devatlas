import { useQuery } from "@tanstack/react-query";

import { getLibrary } from "@/services/library.service";

export const libraryQueryKey = ["library"] as const;

/** Developer library read from Brave. Refreshes when the window regains focus, so links
 * saved in the browser show up as soon as you switch back. */
export function useLibrary() {
  return useQuery({
    queryKey: libraryQueryKey,
    queryFn: getLibrary,
    staleTime: 5_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
}
