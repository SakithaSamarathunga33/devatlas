import { ArrowDown, ArrowUp, Flame, Minus, Trophy } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { SimpleIcon } from "simple-icons";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LanguageRanking } from "@/types/news.types";

import { useLanguageRankings, useTopStories } from "../hooks/use-news";
import { languageIcon } from "../news-icons";
import { StoryList, StoryListSkeleton } from "./story-card";
import { WebLink } from "./web-link";

const STORIES_SHOWN = 8;

const INDEX_LABELS: Record<LanguageRanking["index"], { name: string; basis: string }> = {
  tiobe: { name: "TIOBE", basis: "search-engine results" },
  pypl: { name: "PYPL", basis: "tutorial searches on Google" },
};

/** A brand logo in a tile, in the text colour so mint stays the only hue on the page; falls
 * back to the name's first letters when there is no logo. */
export function BrandIcon({
  icon,
  label,
  className,
}: {
  icon: SimpleIcon | undefined;
  label: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-xs font-semibold text-foreground/80",
        className,
      )}
    >
      {icon === undefined ? (
        label.replace(/[^A-Za-z0-9+#]/g, "").slice(0, 2)
      ) : (
        <svg viewBox="0 0 24 24" className="size-[55%]" fill="currentColor">
          <path d={icon.path} />
        </svg>
      )}
    </span>
  );
}

function SectionHeading({
  id,
  icon,
  title,
  aside,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-3 flex min-h-8 items-center justify-between gap-3">
      <h2 id={id} className="flex items-center gap-2 text-base font-semibold [&>svg]:size-4">
        {icon}
        {title}
      </h2>
      {aside}
    </div>
  );
}

function ShowMore({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="mt-3 w-full rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-medium text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      {expanded ? "Show fewer" : "Show more"}
    </button>
  );
}

/** What developers are discussing right now, across every topic. */
export function TopStories() {
  const stories = useTopStories();
  const [expanded, setExpanded] = useState(false);

  return (
    <section aria-labelledby="top-stories-heading" className="@container min-w-0">
      <SectionHeading
        id="top-stories-heading"
        icon={<Flame className="text-primary" aria-hidden />}
        title="Top stories"
        aside={
          <WebLink href="https://news.ycombinator.com/" className="text-xs text-muted-foreground">
            From Hacker News
          </WebLink>
        }
      />
      {stories.isPending ? (
        <StoryListSkeleton rows={STORIES_SHOWN} />
      ) : stories.isError ? (
        <p role="alert" className="text-sm text-muted-foreground">
          {stories.error.message.replace(/^.*?failed: /, "")}
        </p>
      ) : (
        <>
          <StoryList stories={stories.data.slice(0, expanded ? undefined : STORIES_SHOWN)} />
          {stories.data.length > STORIES_SHOWN && (
            <ShowMore
              expanded={expanded}
              onToggle={() => {
                setExpanded((open) => !open);
              }}
            />
          )}
        </>
      )}
    </section>
  );
}

function Movement({ rank, previousRank }: { rank: number; previousRank: number | null }) {
  if (previousRank === null) return <span className="w-8 shrink-0" />;
  const delta = previousRank - rank;
  if (delta === 0) {
    return (
      <span className="flex w-8 shrink-0 justify-center text-muted-foreground">
        <Minus className="size-3" aria-hidden />
        <span className="sr-only">same place as last year</span>
      </span>
    );
  }
  const up = delta > 0;
  const places = Math.abs(delta);
  return (
    <span
      className={cn(
        "inline-flex w-8 shrink-0 items-center justify-center gap-0.5 text-xs tabular-nums",
        up ? "text-primary" : "text-muted-foreground",
      )}
    >
      {up ? (
        <ArrowUp className="size-3" aria-hidden />
      ) : (
        <ArrowDown className="size-3" aria-hidden />
      )}
      <span aria-hidden>{places}</span>
      <span className="sr-only">
        {up ? "up" : "down"} {places === 1 ? "one place" : `${String(places)} places`} since last
        year
      </span>
    </span>
  );
}

function formatChange(change: number): string {
  return `${change > 0 ? "+" : ""}${change.toFixed(2)}`;
}

/** How popular languages are, from the monthly TIOBE and PYPL indexes, side by side. */
export function LanguageRankings() {
  const rankings = useLanguageRankings();

  if (rankings.isPending) {
    return (
      <div role="status" aria-busy="true" className="grid gap-6 xl:grid-cols-2">
        <span className="sr-only">Loading language rankings</span>
        {Array.from({ length: 2 }, (_, index) => (
          <Skeleton key={index} className="h-96 rounded-xl" />
        ))}
      </div>
    );
  }
  if (rankings.isError || rankings.data.length === 0) {
    return (
      <p role="alert" className="text-sm text-muted-foreground">
        The language rankings couldn&apos;t be loaded right now. Try again later.
      </p>
    );
  }
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {rankings.data.map((ranking) => (
        <section
          key={ranking.index}
          aria-labelledby={`ranking-${ranking.index}`}
          className="min-w-0"
        >
          <SectionHeading
            id={`ranking-${ranking.index}`}
            icon={<Trophy className="text-primary" aria-hidden />}
            title={`${INDEX_LABELS[ranking.index].name} Index`}
            aside={<span className="text-xs text-muted-foreground">{ranking.period}</span>}
          />
          <RankingTable ranking={ranking} />
        </section>
      ))}
    </div>
  );
}

function RankingTable({ ranking }: { ranking: LanguageRanking }) {
  const label = INDEX_LABELS[ranking.index];
  const top = ranking.languages[0]?.share ?? 1;

  return (
    <div className="rounded-xl border border-border bg-card">
      <div
        aria-hidden
        className="flex items-center gap-3 border-b border-border px-4 py-2 text-xs text-muted-foreground"
      >
        <span className="w-5 text-right">#</span>
        <span className="w-8" />
        <span className="flex-1">Language</span>
        <span className="w-14 text-right">Share</span>
        <span className="w-14 text-right">1 yr</span>
      </div>
      <ol aria-label={`${label.name} ranking`} className="divide-y divide-border">
        {ranking.languages.map((entry) => (
          <li key={entry.language} className="flex items-center gap-3 px-4 py-2">
            <span className="w-5 shrink-0 text-right text-sm text-muted-foreground tabular-nums">
              {entry.rank}
            </span>
            <Movement rank={entry.rank} previousRank={entry.previousRank} />
            <BrandIcon
              icon={languageIcon(entry.language)}
              label={entry.language}
              className="size-7 rounded-md"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{entry.language}</p>
              <div aria-hidden className="mt-1 h-0.5 rounded-full bg-accent">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${String(Math.max(2, (entry.share / top) * 100))}%` }}
                />
              </div>
            </div>
            <span className="w-14 shrink-0 text-right text-sm tabular-nums">
              {entry.share.toFixed(2)}%
            </span>
            <span
              className={cn(
                "w-14 shrink-0 text-right text-xs tabular-nums",
                entry.change !== null && entry.change > 0
                  ? "text-primary"
                  : "text-muted-foreground",
              )}
            >
              {entry.change === null ? "–" : formatChange(entry.change)}
            </span>
          </li>
        ))}
      </ol>
      <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
        {label.name} Index, {ranking.period}: based on {label.basis}, updated monthly.{" "}
        <WebLink href={ranking.sourceUrl} className="text-primary">
          About {label.name}
        </WebLink>
      </p>
    </div>
  );
}
