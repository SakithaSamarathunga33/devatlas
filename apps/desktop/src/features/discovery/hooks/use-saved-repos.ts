import { useQueries } from "@tanstack/react-query";

import { useLibrary } from "@/hooks/use-library";
import { getGithubRepo } from "@/services/discovery.service";
import type { GithubRepo } from "@/types/discovery.types";
import type { Resource } from "@/types/library.types";

import { githubFullName } from "../repo-utils";

/** Matches the Rust-side cache for single repositories. */
const DETAILS_FRESH_FOR_MS = 60 * 60 * 1000;

export interface SavedRepo {
  resource: Resource;
  fullName: string;
  /** From GitHub; missing while loading or when GitHub could not be asked. */
  details: GithubRepo | undefined;
  detailsFailed: boolean;
}

/** GitHub repositories in the library (Brave bookmarks and links added in DevAtlas), each
 * with its language, stars and description fetched once and cached. */
export function useSavedRepos() {
  const library = useLibrary();
  const saved = (library.data?.resources ?? []).flatMap((resource) => {
    const fullName = githubFullName(resource.url);
    return fullName === null ? [] : [{ resource, fullName }];
  });
  const details = useQueries({
    queries: saved.map(({ fullName }) => ({
      queryKey: ["github-repo", fullName.toLowerCase()],
      queryFn: () => getGithubRepo(fullName),
      staleTime: DETAILS_FRESH_FOR_MS,
      // GitHub allows 60 unauthenticated requests an hour; failures are shown, not retried.
      retry: false,
    })),
  });

  const repos: SavedRepo[] = saved.map((repo, index) => ({
    ...repo,
    details: details[index]?.data,
    detailsFailed: details[index]?.isError ?? false,
  }));
  return { library, repos };
}
