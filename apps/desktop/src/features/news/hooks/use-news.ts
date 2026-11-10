import { useQuery } from "@tanstack/react-query";

import { listLanguageRankings, listNews, listTopStories } from "@/services/news.service";

const MINUTE_MS = 60 * 1000;

// Freshness matches the Rust-side caches; failures are shown, not retried, so a slow or
// blocked site is not hammered.

export function useNews() {
  return useQuery({
    queryKey: ["news"],
    queryFn: listNews,
    staleTime: 30 * MINUTE_MS,
    retry: false,
  });
}

export function useTopStories() {
  return useQuery({
    queryKey: ["top-stories"],
    queryFn: listTopStories,
    staleTime: 10 * MINUTE_MS,
    retry: false,
  });
}

export function useLanguageRankings() {
  return useQuery({
    queryKey: ["language-rankings"],
    queryFn: listLanguageRankings,
    staleTime: 6 * 60 * MINUTE_MS,
    retry: false,
  });
}
