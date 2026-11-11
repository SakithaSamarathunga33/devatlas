import { ArrowDown, ArrowUp, Minus, Shuffle, Star } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StarBoards, StarBoardView, StarRepo } from "@/types/discovery.types";

import { useStarBoards } from "../hooks/use-star-boards";
import { compactNumber, openExternal } from "../repo-utils";
import { REPO_LIST, RepoListError, RepoListSkeleton, RepoRow, SaveRepoButton } from "./repo-ui";

const SITE = "https://www.star-history.com/";
const RANDOM_PICKS = 20;
const UNPUBLISHED = "Star History hasn't published this ranking yet.";

type IsSaved = (fullName: string) => boolean;

function matches(repo: StarRepo, search: string): boolean {
  return repo.fullName.toLowerCase().includes(search.trim().toLowerCase());
}

function randomSample<T>(items: readonly T[], count: number): T[] {
  return items
    .map((item) => ({ item, order: Math.random() }))
    .sort((a, b) => a.order - b.order)
    .slice(0, count)
    .map(({ item }) => item);
}

/** Enough decimals that the rarest tiers don't round to zero. */
function sharePercent(count: number, total: number): string {
  const share = (count / total) * 100;
  const digits = share >= 0.1 ? 1 : share >= 0.01 ? 3 : share >= 0.001 ? 4 : 5;
  return `${share.toFixed(digits)}%`;
}

interface StarBoardsViewProps {
  view: StarBoardView;
  search: string;
  isSaved: IsSaved;
}

/** star-history.com's rankings: one board at a time, chosen by the tabs above it. */
export function StarBoardsView({ view, search, isSaved }: StarBoardsViewProps) {
  const boards = useStarBoards();

  if (boards.isPending) return <RepoListSkeleton label="Loading Star History rankings" />;
  if (boards.isError) {
    return <RepoListError title="Star History rankings unavailable" query={boards} />;
  }
  return (
    // Keyed so a refetch can't leave the random draw holding repositories from the old data.
    <Board
      key={boards.dataUpdatedAt}
      boards={boards.data}
      view={view}
      search={search}
      isSaved={isSaved}
    />
  );
}

function Board({ boards, view, search, isSaved }: StarBoardsViewProps & { boards: StarBoards }) {
  switch (view) {
    case "weekly":
      return (
        <RankedBoard
          label="Star History weekly ranking"
          repos={boards.weekly}
          updated={boards.weeklyPeriod}
          search={search}
          isSaved={isSaved}
        />
      );
    case "alltime":
      return (
        <RankedBoard
          label="Star History all-time ranking"
          repos={boards.allTime}
          updated={boards.allTimeUpdated}
          search={search}
          isSaved={isSaved}
        />
      );
    case "random":
      return <RandomBoard pool={boards.randomPool} search={search} isSaved={isSaved} />;
    case "pyramid":
      return <Pyramid tiers={boards.pyramid} updated={boards.pyramidUpdated} />;
  }
}

function RankedBoard({
  label,
  repos,
  updated,
  search,
  isSaved,
}: {
  label: string;
  repos: readonly StarRepo[];
  updated: string | null;
  search: string;
  isSaved: IsSaved;
}) {
  if (repos.length === 0) {
    return <p className="mt-8 text-sm text-muted-foreground">{UNPUBLISHED}</p>;
  }
  // Positions come from the site's order, so they stay put while searching.
  const ranked = repos
    .map((repo, index) => ({ repo, rank: index + 1 }))
    .filter(({ repo }) => matches(repo, search));

  return (
    <>
      {ranked.length === 0 ? (
        <NoMatches search={search} />
      ) : (
        <ol aria-label={label} className={cn("mt-4", REPO_LIST)}>
          {ranked.map(({ repo, rank }) => (
            <li key={repo.fullName}>
              <StarRow repo={repo} rank={rank} saved={isSaved(repo.fullName)} />
            </li>
          ))}
        </ol>
      )}
      <Credit updated={updated} />
    </>
  );
}

/** A random draw from the site's list; a new one each visit, or on Shuffle. */
function RandomBoard({
  pool,
  search,
  isSaved,
}: {
  pool: readonly StarRepo[];
  search: string;
  isSaved: IsSaved;
}) {
  const [picks, setPicks] = useState(() => randomSample(pool, RANDOM_PICKS));
  if (pool.length === 0) {
    return <p className="mt-8 text-sm text-muted-foreground">{UNPUBLISHED}</p>;
  }
  const searching = search.trim() !== "";
  const visible = searching
    ? pool.filter((repo) => matches(repo, search)).slice(0, RANDOM_PICKS)
    : picks;

  return (
    <>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {searching ? "Searching" : `${String(picks.length)} random picks from`}{" "}
          {pool.length.toLocaleString("en")} repositories
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setPicks(randomSample(pool, RANDOM_PICKS));
          }}
        >
          <Shuffle aria-hidden />
          Shuffle
        </Button>
      </div>
      {visible.length === 0 ? (
        <NoMatches search={search} />
      ) : (
        <ol aria-label="Random repositories" className={cn("mt-3", REPO_LIST)}>
          {visible.map((repo) => (
            <li key={repo.fullName}>
              <StarRow repo={repo} saved={isSaved(repo.fullName)} />
            </li>
          ))}
        </ol>
      )}
      <Credit updated={null} />
    </>
  );
}

function NoMatches({ search }: { search: string }) {
  return (
    <p className="mt-8 text-sm text-muted-foreground">
      No repositories match &ldquo;{search}&rdquo;.
    </p>
  );
}

function StarRow({ repo, rank, saved }: { repo: StarRepo; rank?: number; saved: boolean }) {
  const url = `https://github.com/${repo.fullName}`;
  return (
    <RepoRow
      fullName={repo.fullName}
      url={url}
      details={undefined}
      rank={rank}
      marker={repo.newStars === null ? undefined : <RankChange change={repo.rankChange} />}
      metric={<StarMetric repo={repo} />}
      action={<SaveRepoButton repo={{ fullName: repo.fullName, url }} saved={saved} />}
    />
  );
}

function Mark({
  label,
  className,
  children,
}: {
  label: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <span title={label} className={cn("flex w-4 shrink-0 justify-center", className)}>
      {children}
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Movement since last week: mint when climbing, grey when falling, as on the Rankings page. */
function RankChange({ change }: { change: number | null }) {
  if (change === null) {
    return (
      <Mark label="New to top 20" className="text-primary">
        <span aria-hidden className="text-[11px] font-semibold">
          N
        </span>
      </Mark>
    );
  }
  if (change === 0) {
    return (
      <Mark label="No change" className="text-muted-foreground">
        <Minus className="size-3" aria-hidden />
      </Mark>
    );
  }
  return change > 0 ? (
    <Mark label={`Up ${String(change)}`} className="text-primary">
      <ArrowUp className="size-3" aria-hidden />
    </Mark>
  ) : (
    <Mark label={`Down ${String(-change)}`} className="text-muted-foreground">
      <ArrowDown className="size-3" aria-hidden />
    </Mark>
  );
}

function StarMetric({ repo }: { repo: StarRepo }) {
  return (
    <div className="flex shrink-0 items-center gap-4 text-xs tabular-nums">
      {repo.newStars !== null && (
        <span
          title={`+${repo.newStars.toLocaleString("en")} stars this week`}
          className="w-14 text-right font-medium text-primary"
        >
          +{compactNumber.format(repo.newStars)}
          <span className="sr-only"> new stars this week</span>
        </span>
      )}
      <span
        title={`${repo.stars.toLocaleString("en")} stars`}
        className="inline-flex w-16 items-center justify-end gap-1.5 text-muted-foreground"
      >
        <Star className="size-3.5" aria-hidden />
        {compactNumber.format(repo.stars)}
        <span className="sr-only">stars</span>
      </span>
    </div>
  );
}

/** How many repositories reach each star count; the catch-all "1+" tier is only the total. */
function Pyramid({ tiers, updated }: { tiers: StarBoards["pyramid"]; updated: string | null }) {
  const shown = tiers.filter((tier) => tier.threshold > 1);
  if (shown.length === 0) {
    return <p className="mt-8 text-sm text-muted-foreground">{UNPUBLISHED}</p>;
  }
  const widest = Math.max(1, ...shown.map((tier) => tier.count));
  const total = tiers.find((tier) => tier.threshold === 1)?.count ?? widest;

  return (
    <div className="max-w-3xl">
      <ol
        aria-label="Repositories by star count"
        className="mt-4 space-y-1 rounded-xl border border-border bg-card p-4"
      >
        {shown.map((tier) => (
          <li
            key={tier.threshold}
            className="grid grid-cols-[4.5rem_1fr_8rem] items-center gap-3 text-xs tabular-nums"
          >
            <span className="inline-flex items-center gap-1 font-medium">
              <Star className="size-3 text-primary" aria-hidden />
              {tier.label}
            </span>
            <span className="flex h-6 justify-center">
              <span
                aria-hidden
                className="h-full rounded-sm bg-primary/70"
                style={{ width: `${String((tier.count / widest) * 100)}%`, minWidth: 2 }}
              />
            </span>
            <span
              title={`${tier.count.toLocaleString("en")} repositories`}
              className="text-right text-muted-foreground"
            >
              {compactNumber.format(tier.count)} ({sharePercent(tier.count, total)})
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted-foreground">
        Share of the {compactNumber.format(total)} GitHub repositories with at least one star.
      </p>
      <Credit updated={updated} />
    </div>
  );
}

function Credit({ updated }: { updated: string | null }) {
  return (
    <p className="mt-3 text-xs text-muted-foreground">
      {updated !== null && `Updated ${updated} · `}Data from{" "}
      <a
        href={SITE}
        onClick={(event) => {
          event.preventDefault();
          openExternal(SITE, "star-history.com");
        }}
        className="rounded text-primary outline-none hover:underline hover:underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring"
      >
        star-history.com
      </a>
    </p>
  );
}
