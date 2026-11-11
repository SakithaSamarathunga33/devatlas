import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { pixel, proportional, Table, type TableColumn } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import { VStack } from "@astryxdesign/core/VStack";
import { ArrowDown, ArrowUp, Flame, Minus, Newspaper, Trophy } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { SimpleIcon } from "simple-icons";

import { brandTile } from "@/lib/brand-color";
import { cn } from "@/lib/utils";
import type { LanguageRanking } from "@/types/news.types";

import { useLanguageRankings, useTopStories } from "../hooks/use-news";
import { languageIcon } from "../news-icons";
import { FeedError } from "./feed-error";
import { StoryList, StoryListSkeleton } from "./story-card";
import { WebLink } from "./web-link";

const STORIES_SHOWN = 8;

const INDEX_LABELS: Record<LanguageRanking["index"], { name: string; basis: string }> = {
  tiobe: { name: "TIOBE", basis: "search-engine results" },
  pypl: { name: "PYPL", basis: "tutorial searches on Google" },
};

/** A brand logo on a tile in the brand's own colour, so each source and language is easy to
 * tell apart; falls back to `fallback`, then the name's first letters, when there is no logo. */
export function BrandIcon({
  icon,
  label,
  className,
  fallback,
}: {
  icon: SimpleIcon | undefined;
  label: string;
  className?: string;
  fallback?: ReactNode;
}) {
  const tile = icon === undefined ? undefined : brandTile(icon.hex);
  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center rounded-lg", className)}
      style={{
        backgroundColor: tile?.background ?? "var(--color-background-muted)",
        color: tile?.ink,
        // Keeps near-black and near-white brands visible against the page.
        boxShadow: "inset 0 0 0 1px var(--color-border)",
      }}
    >
      {icon === undefined ? (
        (fallback ?? (
          <Text type="supporting" weight="semibold">
            {label.replace(/[^A-Za-z0-9+#]/g, "").slice(0, 2)}
          </Text>
        ))
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
    <HStack gap={3} vAlign="center" hAlign="between">
      <HStack gap={2} vAlign="center">
        {icon}
        <Heading level={2} id={id}>
          {title}
        </Heading>
      </HStack>
      {aside}
    </HStack>
  );
}

/** What developers are discussing right now, across every topic. */
export function TopStories({ matches }: { matches?: (text: string) => boolean }) {
  const stories = useTopStories();
  const [expanded, setExpanded] = useState(false);
  const shown = (stories.data ?? []).filter(
    (story) => matches === undefined || matches(story.title),
  );

  return (
    <section aria-labelledby="top-stories-heading" className="@container min-w-0">
      <VStack gap={3}>
        <SectionHeading
          id="top-stories-heading"
          icon={<Icon icon={Flame} color="accent" />}
          title="Top stories"
          aside={
            <Text type="supporting">
              <WebLink href="https://news.ycombinator.com/">From Hacker News</WebLink>
            </Text>
          }
        />
        {stories.isPending ? (
          <StoryListSkeleton rows={STORIES_SHOWN} />
        ) : stories.isError ? (
          <FeedError title="Top stories unavailable" query={stories} />
        ) : shown.length === 0 ? (
          <EmptyState
            isCompact
            icon={<Icon icon={Newspaper} />}
            title={
              matches === undefined
                ? "No stories right now."
                : "Nothing in today's top stories matches your interests."
            }
          />
        ) : (
          <>
            <StoryList stories={shown.slice(0, expanded ? undefined : STORIES_SHOWN)} />
            {shown.length > STORIES_SHOWN && (
              <Button
                label={expanded ? "Show fewer" : "Show more"}
                variant="ghost"
                width="100%"
                onClick={() => {
                  setExpanded((open) => !open);
                }}
              />
            )}
          </>
        )}
      </VStack>
    </section>
  );
}

function Movement({ rank, previousRank }: { rank: number; previousRank: number | null }) {
  if (previousRank === null) return null;
  const delta = previousRank - rank;
  if (delta === 0) {
    return (
      <>
        <Icon icon={Minus} size="xsm" color="secondary" />
        <VisuallyHidden>same place as last year</VisuallyHidden>
      </>
    );
  }
  const up = delta > 0;
  const places = Math.abs(delta);
  return (
    <HStack as="span" gap={0.5} vAlign="center">
      <Icon icon={up ? ArrowUp : ArrowDown} size="xsm" color={up ? "accent" : "secondary"} />
      <span aria-hidden>
        <Text type="supporting" color={up ? "accent" : "secondary"} hasTabularNumbers>
          {places}
        </Text>
      </span>
      <VisuallyHidden>
        {up ? "up" : "down"} {places === 1 ? "one place" : `${String(places)} places`} since last
        year
      </VisuallyHidden>
    </HStack>
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
      <Grid columns={{ minWidth: 480, max: 2 }} gap={6} role="status" aria-busy="true">
        <VisuallyHidden>Loading language rankings</VisuallyHidden>
        {Array.from({ length: 2 }, (_, index) => (
          <Skeleton key={index} height={384} index={index} />
        ))}
      </Grid>
    );
  }
  if (rankings.isError) {
    return <FeedError title="Language rankings unavailable" query={rankings} />;
  }
  if (rankings.data.length === 0) {
    return (
      <EmptyState
        icon={<Icon icon={Trophy} />}
        title="No language rankings yet."
        description="TIOBE and PYPL publish monthly. Check back later."
      />
    );
  }
  return (
    <Grid columns={{ minWidth: 480, max: 2 }} gap={6}>
      {rankings.data.map((ranking) => (
        <section
          key={ranking.index}
          aria-labelledby={`ranking-${ranking.index}`}
          className="min-w-0"
        >
          <VStack gap={3}>
            <SectionHeading
              id={`ranking-${ranking.index}`}
              icon={<Icon icon={Trophy} color="accent" />}
              title={`${INDEX_LABELS[ranking.index].name} Index`}
              aside={<Text type="supporting">{ranking.period}</Text>}
            />
            <RankingTable ranking={ranking} />
          </VStack>
        </section>
      ))}
    </Grid>
  );
}

type RankingEntry = LanguageRanking["languages"][number];

function rankingColumns(top: number): TableColumn<RankingEntry>[] {
  return [
    {
      key: "rank",
      header: "#",
      width: pixel(48),
      align: "end",
      renderCell: (entry) => (
        <Text color="secondary" hasTabularNumbers>
          {entry.rank}
        </Text>
      ),
    },
    {
      key: "movement",
      header: <VisuallyHidden>Movement</VisuallyHidden>,
      width: pixel(48),
      align: "center",
      renderCell: (entry) => <Movement rank={entry.rank} previousRank={entry.previousRank} />,
    },
    {
      key: "language",
      header: "Language",
      width: proportional(1, { minWidth: 160 }),
      renderCell: (entry) => (
        <HStack gap={3} vAlign="center">
          <BrandIcon
            icon={languageIcon(entry.language)}
            label={entry.language}
            className="size-7 rounded-md"
          />
          <div className="min-w-0 flex-1">
            <VStack gap={1}>
              <Text weight="medium" maxLines={1}>
                {entry.language}
              </Text>
              <div aria-hidden>
                <ProgressBar
                  label={`${entry.language} share`}
                  isLabelHidden
                  value={entry.share}
                  max={top}
                />
              </div>
            </VStack>
          </div>
        </HStack>
      ),
    },
    {
      key: "share",
      header: "Share",
      width: pixel(84),
      align: "end",
      renderCell: (entry) => <Text hasTabularNumbers>{entry.share.toFixed(2)}%</Text>,
    },
    {
      key: "change",
      header: "1 yr",
      width: pixel(72),
      align: "end",
      renderCell: (entry) => (
        <Text
          type="supporting"
          color={entry.change !== null && entry.change > 0 ? "accent" : "secondary"}
          hasTabularNumbers
        >
          {entry.change === null ? "–" : formatChange(entry.change)}
        </Text>
      ),
    },
  ];
}

function RankingTable({ ranking }: { ranking: LanguageRanking }) {
  const label = INDEX_LABELS[ranking.index];
  const top = ranking.languages[0]?.share ?? 1;

  return (
    <VStack gap={2}>
      <Table
        aria-label={`${label.name} ranking`}
        data={ranking.languages}
        idKey="language"
        columns={rankingColumns(top)}
        density="compact"
      />
      <Text type="supporting" as="p">
        {label.name} Index, {ranking.period}: based on {label.basis}, updated monthly.{" "}
        <WebLink href={ranking.sourceUrl} color="accent">
          About {label.name}
        </WebLink>
      </Text>
    </VStack>
  );
}
