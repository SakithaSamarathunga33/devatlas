import { Banner } from "@astryxdesign/core/Banner";
import { Divider } from "@astryxdesign/core/Divider";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Link as AstryxLink } from "@astryxdesign/core/Link";
import { List, ListItem } from "@astryxdesign/core/List";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Section } from "@astryxdesign/core/Section";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { formatDistanceToNowStrict, startOfMonth, subMonths } from "date-fns";
import { ArrowRight, Bookmark, ChevronRight, Flame, FolderOpen, History } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { Link } from "react-router";

import { GithubMark, TrendingPreview } from "@/features/discovery";
import { SiteIcon } from "@/features/library";
import { NewsPreview } from "@/features/news";
import { useLibrary } from "@/hooks/use-library";
import { useResourcePreview } from "@/hooks/use-resource-preview";
import { rediscoverable } from "@/lib/ecosystems";
import { CATEGORY_META, countByCategory } from "@/lib/resource-categories";
import { cn } from "@/lib/utils";
import type { Resource } from "@/types/library.types";

import { librarySummary } from "../library-summary";
import { SavesChart } from "./saves-chart";
import { ShareRing } from "./share-ring";
import { WelcomeHero } from "./welcome-hero";

const MONTHS_SHOWN = 8;
const LATEST_SHOWN = 5;

type LibraryState = "loading" | "failed" | "ready";

/** Resources saved per calendar month, oldest first, for the last `MONTHS_SHOWN` months. */
function monthlyAdditions(resources: readonly Resource[], now: Date): number[] {
  const start = startOfMonth(subMonths(now, MONTHS_SHOWN - 1)).getTime();
  const counts = Array.from({ length: MONTHS_SHOWN }, () => 0);
  for (const { addedAt } of resources) {
    if (addedAt === null || addedAt < start) continue;
    const date = new Date(addedAt);
    const index =
      (date.getFullYear() - new Date(start).getFullYear()) * 12 +
      date.getMonth() -
      new Date(start).getMonth();
    if (index >= 0 && index < MONTHS_SHOWN) counts[index] = (counts[index] ?? 0) + 1;
  }
  return counts;
}

function monthStarts(now: Date): Date[] {
  return Array.from({ length: MONTHS_SHOWN }, (_, index) =>
    startOfMonth(subMonths(now, MONTHS_SHOWN - 1 - index)),
  );
}

function plural(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? "" : "s"}`;
}

function newestFirst(resources: readonly Resource[]): Resource[] {
  return [...resources].sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0));
}

function resourcePath(resource: Resource): string {
  return `/library/${encodeURIComponent(resource.id)}`;
}

/** Three bands: the greeting, the library at a glance, then what's new outside it beside a
 * rail of the library itself. */
export function DashboardPage() {
  const library = useLibrary();
  const resources = library.data?.resources ?? [];
  const state: LibraryState =
    library.data !== undefined ? "ready" : library.isError ? "failed" : "loading";

  return (
    <div className="mx-auto w-full max-w-[1600px]">
      <VStack gap={6} padding={6}>
        <WelcomeHero
          summary={library.data === undefined ? null : librarySummary(resources, new Date())}
        />
        {library.isError && library.data === undefined && (
          <Banner
            role="alert"
            status="error"
            title="Your library couldn't be read"
            description={library.error.message.replace(/^.*?failed: /, "")}
          />
        )}
        {state === "loading" && <OverviewSkeleton />}
        {state === "ready" && <LibraryOverview resources={resources} />}
        <Divider />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <VStack gap={6} className="min-w-0">
            <Panel title="Top stories" icon={Flame} viewAll="/news">
              <NewsPreview />
            </Panel>
            <Panel title="New on GitHub" icon={GithubMark} viewAll="/discovery">
              <TrendingPreview />
            </Panel>
          </VStack>

          <Section variant="transparent" padding={0}>
            <VStack gap={6}>
              <Panel title="Latest saves" icon={Bookmark} viewAll="/library">
                <LibrarySlot state={state}>
                  <LatestSaves resources={resources} />
                </LibrarySlot>
              </Panel>
              <Rediscover resources={resources} />
              <Panel title="Categories" icon={FolderOpen} viewAll="/library">
                <LibrarySlot state={state}>
                  <Collections resources={resources} />
                </LibrarySlot>
              </Panel>
            </VStack>
          </Section>
        </div>
      </VStack>
    </div>
  );
}

interface PanelProps {
  title: string;
  icon: ComponentType<{ className?: string }>;
  viewAll?: string;
  children: ReactNode;
}

function panelId(title: string): string {
  return `panel-${title.toLowerCase().replaceAll(" ", "-")}`;
}

/** A named dashboard region: a heading row, then its list. */
function Panel({ title, icon, viewAll, children }: PanelProps) {
  const id = panelId(title);
  return (
    <VStack as="section" aria-labelledby={id} gap={2} className="min-w-0">
      <HStack gap={3} hAlign="between" vAlign="center">
        <HStack gap={2} vAlign="center">
          <Icon icon={icon} size="sm" color="accent" />
          <Heading level={2} id={id}>
            {title}
          </Heading>
        </HStack>
        {viewAll !== undefined && (
          <AstryxLink href={viewAll} type="supporting" weight="medium">
            <span className="inline-flex items-center gap-1">
              View all
              <Icon icon={ArrowRight} size="xsm" />
            </span>
          </AstryxLink>
        )}
      </HStack>
      {children}
    </VStack>
  );
}

/** Holds a rail panel's place until the library is readable. The failure is explained once,
 * in the banner above. */
function LibrarySlot({ state, children }: { state: LibraryState; children: ReactNode }) {
  if (state === "ready") return children;
  if (state === "failed") return <Text type="supporting">Unavailable right now.</Text>;
  return (
    <VStack role="status" aria-busy="true" gap={2}>
      <span className="sr-only">Reading your library…</span>
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} index={index} height={44} />
      ))}
    </VStack>
  );
}

function OverviewSkeleton() {
  return (
    <VStack role="status" aria-busy="true">
      <span className="sr-only">Reading your library…</span>
      <Skeleton height={128} />
    </VStack>
  );
}

/** The library at a glance: total, a bar split by category, and this month's saves. */
function LibraryOverview({ resources }: { resources: readonly Resource[] }) {
  if (resources.length === 0) {
    return (
      <EmptyState
        headingLevel={2}
        icon={<Icon icon={Bookmark} />}
        title="Your library is empty"
        description="Your links are summarized here once you save the first one."
      />
    );
  }
  const now = new Date();
  const monthly = monthlyAdditions(resources, now);
  const months = monthStarts(now).map((date, index) => ({ date, saved: monthly[index] ?? 0 }));
  const thisMonth = monthly.at(-1) ?? 0;
  const lastMonth = monthly.at(-2) ?? 0;
  const newCount = resources.filter((resource) => resource.isNew).length;
  // Rounded down: a full ring must never sit next to links still waiting for review.
  const reviewed = Math.floor(((resources.length - newCount) / resources.length) * 100);
  const categories = countByCategory(resources).sort((a, b) => b.count - a.count);

  // Sized by its own width: the rail leaves it narrow on a mid-size window.
  return (
    <section aria-labelledby="library-breakdown" className="@container min-w-0">
      <div className="grid items-center gap-x-10 gap-y-5 @xl:grid-cols-[auto_minmax(0,1fr)] @4xl:grid-cols-[auto_minmax(0,1fr)_minmax(0,17rem)]">
        <HStack gap={4} vAlign="center">
          {newCount > 0 && (
            <ShareRing percent={reviewed} label={`${String(reviewed)}% of your library reviewed`} />
          )}
          <VStack gap={1}>
            <Heading level={2} id="library-breakdown">
              <Text type="display-2" display="block" hasTabularNumbers>
                {resources.length}
              </Text>{" "}
              <Text type="supporting">{resources.length === 1 ? "resource" : "resources"}</Text>
            </Heading>
            {newCount > 0 ? (
              <AstryxLink href="/library?filter=new" type="supporting" weight="medium">
                Review {plural(newCount, "new link")}
              </AstryxLink>
            ) : (
              <Text type="supporting">
                in {categories.length} {categories.length === 1 ? "category" : "categories"}
              </Text>
            )}
          </VStack>
        </HStack>

        <VStack
          gap={3}
          className="min-w-0 @xl:order-3 @xl:col-span-2 @4xl:order-none @4xl:col-span-1"
        >
          {/* Segments repeat the legend's links for the mouse; keyboard users get the legend. */}
          <div aria-hidden className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
            {categories.map(({ category, count }) => (
              <Link
                key={category}
                to={`/library?filter=${category}`}
                tabIndex={-1}
                title={`${CATEGORY_META[category].label}: ${String(count)}`}
                style={{ flexGrow: count }}
                className={cn("h-full min-w-1.5", CATEGORY_META[category].swatch)}
              />
            ))}
          </div>
          <HStack as="ul" aria-label="Resources by category" gap={4} wrap="wrap">
            {categories.map(({ category, count }) => (
              <li key={category}>
                <AstryxLink
                  href={`/library?filter=${category}`}
                  type="supporting"
                  color="secondary"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className={cn("size-2 rounded-full", CATEGORY_META[category].swatch)}
                    />
                    {CATEGORY_META[category].label}
                    <Text type="supporting" color="primary" weight="medium" hasTabularNumbers>
                      {count}
                    </Text>
                  </span>
                </AstryxLink>
              </li>
            ))}
          </HStack>
        </VStack>

        <VStack gap={1} className="min-w-0">
          <HStack gap={3} hAlign="between">
            <Text type="label">Saved per month</Text>
            <Text type="supporting" hasTabularNumbers>
              {thisMonth} this month · {lastMonth} last
            </Text>
          </HStack>
          <SavesChart months={months} />
        </VStack>
      </div>
    </section>
  );
}

function LatestSaves({ resources }: { resources: readonly Resource[] }) {
  const latest = newestFirst(resources).slice(0, LATEST_SHOWN);
  if (latest.length === 0) {
    return <EmptyState isCompact title="Save your first link with Add link." />;
  }
  return (
    <List density="compact" edge="outset">
      {latest.map((resource) => (
        <LatestRow key={resource.id} resource={resource} />
      ))}
    </List>
  );
}

/** Old links not opened in months, so saving something isn't the last you see of it. */
function Rediscover({ resources }: { resources: readonly Resource[] }) {
  const offered = rediscoverable(resources, new Date().getTime());
  if (offered.length === 0) return null;
  return (
    <Panel title="Rediscover" icon={History}>
      <List density="compact" edge="outset">
        {offered.map((resource) => (
          <LatestRow key={resource.id} resource={resource} />
        ))}
      </List>
    </Panel>
  );
}

function LatestRow({ resource }: { resource: Resource }) {
  const preview = useResourcePreview(resource.url);
  const verb = resource.origin === "devatlas" ? "Added" : "Saved";
  const added =
    resource.addedAt === null
      ? ""
      : ` · ${verb} ${formatDistanceToNowStrict(resource.addedAt, { addSuffix: true })}`;
  return (
    <ListItem
      href={resourcePath(resource)}
      label={resource.title}
      description={`${resource.host}${added}`}
      startContent={
        <SiteIcon
          icon={preview.data?.icon ?? null}
          host={resource.host}
          className="size-10 rounded-lg text-sm"
        />
      }
    />
  );
}

function Collections({ resources }: { resources: readonly Resource[] }) {
  if (resources.length === 0) {
    return <Text type="supporting">Categories appear once you save links.</Text>;
  }
  const categories = countByCategory(resources).sort((a, b) => b.count - a.count);
  return (
    <List density="compact" edge="outset">
      {categories.map(({ category, count }) => {
        const { label, icon } = CATEGORY_META[category];
        return (
          <ListItem
            key={category}
            href={`/library?filter=${category}`}
            label={label}
            description={
              // The count beside it already says this in words.
              <span aria-hidden className="block pt-1">
                <ProgressBar
                  label={label}
                  isLabelHidden
                  variant="neutral"
                  value={(count / resources.length) * 100}
                />
              </span>
            }
            startContent={<Icon icon={icon} size="sm" color="secondary" />}
            endContent={
              <HStack gap={1} vAlign="center">
                <Text type="supporting" hasTabularNumbers>
                  {plural(count, "resource")}
                </Text>
                <Icon icon={ChevronRight} size="sm" color="secondary" />
              </HStack>
            }
          />
        );
      })}
    </List>
  );
}
