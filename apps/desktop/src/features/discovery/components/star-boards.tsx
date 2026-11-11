import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Link as AstryxLink } from "@astryxdesign/core/Link";
import { List, ListItem } from "@astryxdesign/core/List";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import { VStack } from "@astryxdesign/core/VStack";
import { ArrowDown, ArrowUp, Minus, Search, Shuffle, Star, Trophy } from "lucide-react";
import { useId, useState, type MouseEvent, type ReactNode } from "react";

import type { StarBoards, StarBoardView, StarRepo } from "@/types/discovery.types";

import { useStarBoards } from "../hooks/use-star-boards";
import { compactNumber, openExternal } from "../repo-utils";
import {
  ExpandRepoButton,
  OpenOnGithubButton,
  RepoAvatar,
  RepoDetails,
  RepoListError,
  RepoListSkeleton,
  RepoName,
  RepoRow,
  SaveRepoButton,
} from "./repo-ui";

/** Pixel widths of the ranking columns; Repository takes what is left. */
const COLUMN = { rank: 80, number: 112, actions: 224 } as const;

/** Astryx cells default to max-width: 0, which would cap a width set on its own. */
function columnWidth(width: number) {
  return { width, maxWidth: width };
}

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

function repoUrl(repo: StarRepo): string {
  return `https://github.com/${repo.fullName}`;
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

function Unpublished() {
  return <EmptyState icon={<Icon icon={Trophy} />} title={UNPUBLISHED} />;
}

function NoMatches({ search }: { search: string }) {
  return (
    <EmptyState
      isCompact
      icon={<Icon icon={Search} />}
      title={`No repositories match “${search}”.`}
    />
  );
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
  if (repos.length === 0) return <Unpublished />;
  // Positions come from the site's order, so they stay put while searching.
  const ranked = repos
    .map((repo, index) => ({ repo, rank: index + 1 }))
    .filter(({ repo }) => matches(repo, search));
  const hasWeeklyGains = repos.some((repo) => repo.newStars !== null);

  return (
    <VStack gap={3}>
      {ranked.length === 0 ? (
        <NoMatches search={search} />
      ) : (
        <Table aria-label={label} hasHover style={{ tableLayout: "fixed" }}>
          <TableHeader>
            <TableRow isHeaderRow>
              <TableHeaderCell style={columnWidth(COLUMN.rank)}>#</TableHeaderCell>
              <TableHeaderCell>Repository</TableHeaderCell>
              {hasWeeklyGains && (
                <TableHeaderCell className="text-right" style={columnWidth(COLUMN.number)}>
                  This week
                </TableHeaderCell>
              )}
              <TableHeaderCell className="text-right" style={columnWidth(COLUMN.number)}>
                Stars
              </TableHeaderCell>
              <TableHeaderCell style={columnWidth(COLUMN.actions)}>
                <VisuallyHidden>Actions</VisuallyHidden>
              </TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ranked.map(({ repo, rank }) => (
              <BoardRow
                key={repo.fullName}
                repo={repo}
                rank={rank}
                saved={isSaved(repo.fullName)}
                hasWeeklyGains={hasWeeklyGains}
              />
            ))}
          </TableBody>
        </Table>
      )}
      <Credit updated={updated} />
    </VStack>
  );
}

/** One ranked repository: click it (or the chevron) to show its star history. */
function BoardRow({
  repo,
  rank,
  saved,
  hasWeeklyGains,
}: {
  repo: StarRepo;
  rank: number;
  saved: boolean;
  hasWeeklyGains: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const url = repoUrl(repo);
  const toggle = () => {
    setExpanded((open) => !open);
  };
  // Mouse convenience: the chevron is the keyboard and screen-reader path.
  const onRowClick = (event: MouseEvent<HTMLTableRowElement>) => {
    if (event.target instanceof Element && event.target.closest("a, button")) return;
    toggle();
  };

  return (
    <>
      <TableRow onClick={onRowClick} className="cursor-pointer">
        <TableCell>
          <HStack gap={2} vAlign="center">
            <Text color="secondary" hasTabularNumbers>
              {rank}
            </Text>
            {repo.newStars !== null && <RankChange change={repo.rankChange} />}
          </HStack>
        </TableCell>
        <TableCell>
          <HStack gap={3} vAlign="center">
            <RepoAvatar
              fullName={repo.fullName}
              details={undefined}
              className="size-8 rounded-lg"
            />
            <div className="min-w-0">
              <Text as="p" maxLines={1}>
                <RepoName fullName={repo.fullName} url={url} />
              </Text>
            </div>
          </HStack>
        </TableCell>
        {hasWeeklyGains && (
          <TableCell className="text-right">
            <NewStars repo={repo} />
          </TableCell>
        )}
        <TableCell className="text-right">
          <TotalStars repo={repo} />
        </TableCell>
        <TableCell>
          <HStack gap={1} vAlign="center" hAlign="end">
            <SaveRepoButton repo={{ fullName: repo.fullName, url }} saved={saved} />
            <OpenOnGithubButton fullName={repo.fullName} url={url} />
            <ExpandRepoButton
              fullName={repo.fullName}
              expanded={expanded}
              detailsId={detailsId}
              onToggle={toggle}
            />
          </HStack>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={hasWeeklyGains ? 5 : 4}>
            <RepoDetails id={detailsId} fullName={repo.fullName} details={undefined} />
          </TableCell>
        </TableRow>
      )}
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
  if (pool.length === 0) return <Unpublished />;
  const searching = search.trim() !== "";
  const visible = searching
    ? pool.filter((repo) => matches(repo, search)).slice(0, RANDOM_PICKS)
    : picks;

  return (
    <VStack gap={3}>
      <HStack gap={3} vAlign="center" hAlign="between">
        <Text type="supporting">
          {searching ? "Searching" : `${String(picks.length)} random picks from`}{" "}
          {pool.length.toLocaleString("en")} repositories
        </Text>
        <Button
          label="Shuffle"
          size="sm"
          icon={<Icon icon={Shuffle} />}
          onClick={() => {
            setPicks(randomSample(pool, RANDOM_PICKS));
          }}
        />
      </HStack>
      {visible.length === 0 ? (
        <NoMatches search={search} />
      ) : (
        <List aria-label="Random repositories" hasDividers>
          {visible.map((repo) => (
            <RepoRow
              key={repo.fullName}
              fullName={repo.fullName}
              url={repoUrl(repo)}
              details={undefined}
              marker={repo.newStars === null ? undefined : <RankChange change={repo.rankChange} />}
              metric={
                <HStack gap={4} vAlign="center">
                  <NewStars repo={repo} />
                  <TotalStars repo={repo} />
                </HStack>
              }
              action={
                <SaveRepoButton
                  repo={{ fullName: repo.fullName, url: repoUrl(repo) }}
                  saved={isSaved(repo.fullName)}
                />
              }
            />
          ))}
        </List>
      )}
      <Credit updated={null} />
    </VStack>
  );
}

function Mark({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span title={label} className="flex w-4 shrink-0 justify-center">
      {children}
      <VisuallyHidden>{label}</VisuallyHidden>
    </span>
  );
}

/** Movement since last week: accent when climbing, grey when falling, as on the Rankings page. */
function RankChange({ change }: { change: number | null }) {
  if (change === null) {
    return (
      <Mark label="New to top 20">
        <span aria-hidden>
          <Text type="supporting" color="accent" weight="semibold">
            N
          </Text>
        </span>
      </Mark>
    );
  }
  if (change === 0) {
    return (
      <Mark label="No change">
        <Icon icon={Minus} size="xsm" color="secondary" />
      </Mark>
    );
  }
  return change > 0 ? (
    <Mark label={`Up ${String(change)}`}>
      <Icon icon={ArrowUp} size="xsm" color="accent" />
    </Mark>
  ) : (
    <Mark label={`Down ${String(-change)}`}>
      <Icon icon={ArrowDown} size="xsm" color="secondary" />
    </Mark>
  );
}

function NewStars({ repo }: { repo: StarRepo }) {
  if (repo.newStars === null) return null;
  return (
    <span title={`+${repo.newStars.toLocaleString("en")} stars this week`}>
      <Text type="supporting" color="accent" weight="medium" hasTabularNumbers>
        +{compactNumber.format(repo.newStars)}
      </Text>
      <VisuallyHidden> new stars this week</VisuallyHidden>
    </span>
  );
}

function TotalStars({ repo }: { repo: StarRepo }) {
  return (
    <span
      title={`${repo.stars.toLocaleString("en")} stars`}
      className="inline-flex items-center justify-end gap-1.5"
    >
      <Icon icon={Star} size="xsm" color="secondary" />
      <Text type="supporting" hasTabularNumbers>
        {compactNumber.format(repo.stars)}
      </Text>
      <VisuallyHidden>stars</VisuallyHidden>
    </span>
  );
}

/** How many repositories reach each star count; the catch-all "1+" tier is only the total. */
function Pyramid({ tiers, updated }: { tiers: StarBoards["pyramid"]; updated: string | null }) {
  const shown = tiers.filter((tier) => tier.threshold > 1);
  if (shown.length === 0) return <Unpublished />;
  const widest = Math.max(1, ...shown.map((tier) => tier.count));
  const total = tiers.find((tier) => tier.threshold === 1)?.count ?? widest;

  return (
    <VStack gap={3} maxWidth={768}>
      <List aria-label="Repositories by star count" density="compact">
        {shown.map((tier) => (
          <ListItem
            key={tier.threshold}
            startContent={
              <HStack gap={1} vAlign="center" width={72}>
                <Icon icon={Star} size="xsm" color="accent" />
                <Text type="supporting" weight="medium" hasTabularNumbers>
                  {tier.label}
                </Text>
              </HStack>
            }
            label={
              <span aria-hidden className="flex h-6 justify-center">
                <span
                  className="h-full rounded-sm"
                  style={{
                    width: `${String((tier.count / widest) * 100)}%`,
                    minWidth: 2,
                    backgroundColor: "var(--color-accent)",
                  }}
                />
              </span>
            }
            endContent={
              <span
                title={`${tier.count.toLocaleString("en")} repositories`}
                className="w-32 text-right"
              >
                <Text type="supporting" hasTabularNumbers>
                  {compactNumber.format(tier.count)} ({sharePercent(tier.count, total)})
                </Text>
              </span>
            }
          />
        ))}
      </List>
      <Text type="supporting" as="p">
        Share of the {compactNumber.format(total)} GitHub repositories with at least one star.
      </Text>
      <Credit updated={updated} />
    </VStack>
  );
}

function Credit({ updated }: { updated: string | null }) {
  return (
    <Text type="supporting" as="p">
      {updated !== null && `Updated ${updated} · `}Data from{" "}
      <AstryxLink
        href={SITE}
        type="inherit"
        onClick={(event) => {
          event.preventDefault();
          openExternal(SITE, "star-history.com");
        }}
      >
        star-history.com
      </AstryxLink>
    </Text>
  );
}
