import { useQuery } from "@tanstack/react-query";

import { listTrendingRepos } from "@/services/discovery.service";
import type { TrendingPeriod } from "@/types/discovery.types";

/** Matches the Rust-side cache, so switching back to a view never re-asks GitHub. */
const FRESH_FOR_MS = 15 * 60 * 1000;

/** Trending GitHub repositories for a period and optional language. */
export function useTrendingRepos(period: TrendingPeriod, language: string | null) {
  return useQuery({
    queryKey: ["trending-repos", period, language],
    queryFn: () => listTrendingRepos(period, language),
    staleTime: FRESH_FOR_MS,
    // GitHub's search limit is 10 requests a minute; a failed search is shown, not retried.
    retry: false,
  });
}
