import { useQuery } from "@tanstack/react-query";
import { differenceInDays, formatDistanceToNowStrict } from "date-fns";
import { Star, Tag } from "lucide-react";

import { getRepoActivity } from "@/services/discovery.service";

import { RepoLink } from "./repo-ui";

/** Matches the Rust-side cache for single repositories. */
const FRESH_FOR_MS = 60 * 60 * 1000;
const NEW_RELEASE_DAYS = 7;

function growth(count: number, days: number): string {
  const sign = count > 0 ? "+" : "";
  return `${sign}${count.toLocaleString("en")} stars in ${String(days)} ${days === 1 ? "day" : "days"}`;
}

/** A saved repository's newest release and recent star growth; nothing if there is neither. */
export function RepoActivityLine({ fullName }: { fullName: string }) {
  const activity = useQuery({
    queryKey: ["repo-activity", fullName.toLowerCase()],
    queryFn: () => getRepoActivity(fullName),
    staleTime: FRESH_FOR_MS,
    // GitHub allows 60 unauthenticated requests an hour; a failure just shows nothing.
    retry: false,
  });
  const release = activity.data?.latestRelease ?? null;
  const gained = activity.data?.starsGained ?? null;
  const showGrowth = gained !== null && gained.count !== 0;
  if (release === null && !showGrowth) return null;

  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {release !== null && (
        <span className="inline-flex items-center gap-1.5">
          <Tag className="size-3.5" aria-hidden />
          <RepoLink
            url={release.url}
            title={release.name ?? release.tag}
            className="rounded font-medium text-foreground outline-none hover:underline hover:underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring"
          >
            {release.tag}
          </RepoLink>
          {differenceInDays(new Date(), new Date(release.publishedAt)) < NEW_RELEASE_DAYS && (
            <span className="rounded-full bg-highlight px-2 py-px font-semibold text-highlight-foreground">
              New release
            </span>
          )}
          <span>
            {formatDistanceToNowStrict(new Date(release.publishedAt), { addSuffix: true })}
          </span>
        </span>
      )}
      {showGrowth && (
        <span className="inline-flex items-center gap-1.5">
          <Star className="size-3.5" aria-hidden />
          {growth(gained.count, gained.days)}
        </span>
      )}
    </p>
  );
}
