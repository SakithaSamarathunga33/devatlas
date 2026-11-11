import { useQuery } from "@tanstack/react-query";

import { getStarBoards } from "@/services/discovery.service";

/** Matches the Rust-side cache, so switching tabs never re-reads the site. */
const FRESH_FOR_MS = 6 * 60 * 60 * 1000;

/** star-history.com's repository rankings. */
export function useStarBoards() {
  return useQuery({
    queryKey: ["star-boards"],
    queryFn: getStarBoards,
    staleTime: FRESH_FOR_MS,
    retry: false,
  });
}
