import { Star } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useLibrary } from "@/hooks/use-library";

import { useTrendingRepos } from "../hooks/use-trending-repos";
import { compactNumber, libraryId } from "../repo-utils";
import { LanguagePill, RepoAvatar, RepoName, SaveRepoButton } from "./repo-ui";

const SHOWN = 5;

/** This week's top trending GitHub repositories, for the dashboard. Shares its cache with
 * the Discovery page, so it costs no extra GitHub requests. */
export function TrendingPreview() {
  const repos = useTrendingRepos("week", null);
  const library = useLibrary();
  const savedIds = new Set(library.data?.resources.map((resource) => resource.id.toLowerCase()));

  if (repos.isPending) {
    return (
      <div role="status" aria-busy="true" className="space-y-2">
        <span className="sr-only">Loading trending repositories</span>
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-14 rounded-xl" />
        ))}
      </div>
    );
  }
  if (repos.isError) {
    return <p>{repos.error.message.replace(/^.*?failed: /, "")}</p>;
  }
  if (repos.data.length === 0) {
    return <p>No new repositories gained stars this week.</p>;
  }

  return (
    <ol
      aria-label="New this week"
      className="divide-y divide-border rounded-xl border border-border bg-card"
    >
      {repos.data.slice(0, SHOWN).map((repo, index) => (
        <li key={repo.fullName} className="flex items-center gap-3 px-3 py-2.5">
          <span className="w-5 shrink-0 text-right text-sm text-muted-foreground tabular-nums">
            {index + 1}
          </span>
          <RepoAvatar fullName={repo.fullName} details={repo} className="size-9 rounded-lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-foreground">
              <RepoName fullName={repo.fullName} url={repo.url} />
            </p>
            {repo.description !== null && (
              <p className="truncate text-xs text-muted-foreground">{repo.description}</p>
            )}
          </div>
          <div className="hidden shrink-0 items-center gap-3 text-xs text-muted-foreground sm:flex">
            {repo.language !== null && <LanguagePill language={repo.language} />}
            <span className="inline-flex w-14 items-center gap-1">
              <Star className="size-3.5" aria-hidden />
              <span className="tabular-nums">{compactNumber.format(repo.stars)}</span>
              <span className="sr-only">stars</span>
            </span>
          </div>
          <SaveRepoButton repo={repo} saved={savedIds.has(libraryId(repo.fullName))} compact />
        </li>
      ))}
    </ol>
  );
}
