import { format, formatDistanceToNowStrict, startOfMonth, subMonths } from "date-fns";
import {
  Activity,
  ArrowRight,
  Bookmark,
  ChevronRight,
  ExternalLink,
  Flame,
  FolderOpen,
  Plus,
  Star,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { Link } from "react-router";

import { GithubMark, TrendingPreview } from "@/features/discovery";
import { SiteIcon } from "@/features/library";
import { NewsPreview } from "@/features/news";
import { useLibrary } from "@/hooks/use-library";
import { useResourcePreview } from "@/hooks/use-resource-preview";
import { CATEGORY_META, countByCategory } from "@/lib/resource-categories";
import { cn } from "@/lib/utils";
import type { Resource } from "@/types/library.types";

import { SavesChart } from "./saves-chart";
import { ShareRing } from "./share-ring";
import { WelcomeHero } from "./welcome-hero";

const MONTHS_SHOWN = 8;

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

/** Main column: greeting, the library at a glance, then what's new outside it. Side column:
 * the library itself: featured saves, recent activity and collections. */
export function DashboardPage() {
  const library = useLibrary();
  const resources = library.data?.resources ?? [];
  const status = library.isPending
    ? "Reading your Brave bookmarks…"
    : library.isError
      ? library.error.message
      : null;

  return (
    <div className="mx-auto grid w-full max-w-[1600px] gap-5 px-5 pt-5 pb-10 lg:px-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-5">
        <WelcomeHero />
        <LibraryOverview resources={resources} />
        <Section title="Top stories" icon={Flame} viewAll="/news">
          <NewsPreview />
        </Section>
        <Section title="Trending on GitHub" icon={GithubMark} viewAll="/discovery">
          <TrendingPreview />
        </Section>
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <SidePanel title="Featured resources" icon={Star} viewAll="/library">
          {status ?? <FeaturedResources resources={resources} />}
        </SidePanel>
        <SidePanel title="Recent activity" icon={Activity} viewAll="/library">
          {status ?? <RecentActivity resources={resources} />}
        </SidePanel>
        <SidePanel title="Your collections" icon={FolderOpen} viewAll="/library">
          {status ?? <Collections resources={resources} />}
        </SidePanel>
      </div>
    </div>
  );
}

interface SectionProps {
  title: string;
  icon: ComponentType<{ className?: string }>;
  viewAll?: string;
  children: ReactNode;
}

function sectionId(title: string): string {
  return `panel-${title.toLowerCase().replaceAll(" ", "-")}`;
}

function ViewAll({ to }: { to: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 rounded-md px-1 py-1 text-xs font-medium text-primary outline-none hover:underline hover:underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring"
    >
      View all
      <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}

/** A main-column section: heading row, then its own cards or list. */
function Section({ title, icon: Icon, viewAll, children }: SectionProps) {
  const id = sectionId(title);
  return (
    <section aria-labelledby={id} className="@container min-w-0 text-sm text-muted-foreground">
      <div className="mb-3 flex h-8 items-center justify-between gap-3">
        <h2 id={id} className="flex items-center gap-2 text-base font-semibold text-foreground">
          <span aria-hidden className="text-primary">
            <Icon className="size-4" />
          </span>
          {title}
        </h2>
        {viewAll !== undefined && <ViewAll to={viewAll} />}
      </div>
      {children}
    </section>
  );
}

/** A side-column panel: one card with its heading inside. */
function SidePanel({ title, icon: Icon, viewAll, children }: SectionProps) {
  const id = sectionId(title);
  return (
    <section
      aria-labelledby={id}
      className="min-w-0 rounded-xl border border-border bg-card text-sm text-muted-foreground"
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
        <h2 id={id} className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
          <span aria-hidden className="text-primary">
            <Icon className="size-4" />
          </span>
          {title}
        </h2>
        {viewAll !== undefined && <ViewAll to={viewAll} />}
      </div>
      <div className="px-2 pb-2">{children}</div>
    </section>
  );
}

/** The library at a glance: total, a bar split by category, and this month's saves. */
function LibraryOverview({ resources }: { resources: readonly Resource[] }) {
  if (resources.length === 0) return null;
  const now = new Date();
  const monthly = monthlyAdditions(resources, now);
  const months = monthStarts(now).map((date, index) => ({ date, saved: monthly[index] ?? 0 }));
  const thisMonth = monthly.at(-1) ?? 0;
  const lastMonth = monthly.at(-2) ?? 0;
  const newCount = resources.filter((resource) => resource.isNew).length;
  const reviewed = ((resources.length - newCount) / resources.length) * 100;
  const categories = countByCategory(resources).sort((a, b) => b.count - a.count);

  return (
    <section
      aria-labelledby="library-breakdown"
      className="grid items-center gap-x-6 gap-y-5 rounded-xl border border-border bg-card px-5 py-4 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,17rem)]"
    >
      <div className="flex items-center gap-4 lg:border-r lg:border-border lg:pr-6">
        <ShareRing
          percent={reviewed}
          label={`${String(Math.round(reviewed))}% of your library reviewed`}
          showValue
          className="size-16 text-sm"
        />
        <div>
          <h2 id="library-breakdown" className="leading-tight">
            <span className="block text-2xl font-semibold tracking-tight tabular-nums">
              {resources.length}
            </span>{" "}
            <span className="text-xs font-normal text-muted-foreground">
              {resources.length === 1 ? "resource" : "resources"}
            </span>
          </h2>
          {newCount > 0 ? (
            <Link
              to="/library?filter=new"
              className="mt-1.5 inline-flex items-center gap-1.5 rounded text-xs font-medium text-primary outline-none hover:underline hover:underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span aria-hidden className="size-2 rounded-full bg-highlight" />
              Review {plural(newCount, "new link")}
            </Link>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">All reviewed</p>
          )}
        </div>
      </div>

      <div className="min-w-0">
        {/* Segments repeat the legend's links for the mouse; keyboard users get the legend. */}
        <div aria-hidden className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
          {categories.map(({ category, count }) => (
            <Link
              key={category}
              to={`/library?filter=${category}`}
              tabIndex={-1}
              title={`${CATEGORY_META[category].label}: ${String(count)}`}
              style={{ flexGrow: count }}
              className={cn(
                "h-full min-w-1.5 transition-opacity hover:opacity-75",
                CATEGORY_META[category].swatch,
              )}
            />
          ))}
        </div>
        <ul aria-label="Resources by category" className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {categories.map(({ category, count }) => (
            <li key={category}>
              <Link
                to={`/library?filter=${category}`}
                className="inline-flex items-center gap-1.5 rounded text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  aria-hidden
                  className={cn("size-2 rounded-full", CATEGORY_META[category].swatch)}
                />
                {CATEGORY_META[category].label}
                <span className="font-medium text-foreground tabular-nums">{count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="min-w-0 lg:border-l lg:border-border lg:pl-6">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs font-medium text-foreground">Saved per month</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {thisMonth} this month · {lastMonth} last
          </p>
        </div>
        <SavesChart months={months} />
      </div>
    </section>
  );
}

function FeaturedResources({ resources }: { resources: readonly Resource[] }) {
  const featured = newestFirst(resources).slice(0, 4);
  if (featured.length === 0) {
    return <p className="px-2 pb-2">Save links in Brave › develop or with Add link.</p>;
  }
  return (
    <ul className="flex flex-col">
      {featured.map((resource) => (
        <li key={resource.id}>
          <FeaturedRow resource={resource} />
        </li>
      ))}
    </ul>
  );
}

function FeaturedRow({ resource }: { resource: Resource }) {
  const preview = useResourcePreview(resource.url);
  return (
    <Link
      to={resourcePath(resource)}
      className="flex items-center gap-3 rounded-lg px-2 py-2 outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
    >
      <SiteIcon
        icon={preview.data?.icon ?? null}
        host={resource.host}
        className={cn(
          "size-10 rounded-lg bg-linear-to-br text-sm",
          CATEGORY_META[resource.category].tint,
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[13px] leading-snug font-medium text-foreground">
          {resource.title}
        </span>
        <span className="mt-0.5 flex items-center gap-3 text-xs">
          <span className="inline-flex min-w-0 items-center gap-1 truncate">
            {resource.host}
            <ExternalLink className="size-3 shrink-0" aria-hidden />
          </span>
          {resource.addedAt !== null && (
            <span className="ml-auto shrink-0">Saved {format(resource.addedAt, "MMM yyyy")}</span>
          )}
        </span>
      </span>
    </Link>
  );
}

function RecentActivity({ resources }: { resources: readonly Resource[] }) {
  const recent = newestFirst(resources)
    .filter((resource) => resource.addedAt !== null)
    .slice(0, 5);
  if (recent.length === 0) return <p className="px-2 pb-2">Nothing saved yet.</p>;
  return (
    <ul className="flex flex-col">
      {recent.map((resource) => {
        const added = resource.origin === "devatlas";
        const Icon = added ? Plus : Bookmark;
        return (
          <li key={resource.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[13px]">
              {added ? "Added " : "Saved "}
              <Link
                to={resourcePath(resource)}
                className="font-medium text-foreground hover:underline"
              >
                {resource.title}
              </Link>
            </span>
            <time className="shrink-0 text-xs tabular-nums">
              {formatDistanceToNowStrict(resource.addedAt ?? 0, { addSuffix: true })}
            </time>
          </li>
        );
      })}
    </ul>
  );
}

function Collections({ resources }: { resources: readonly Resource[] }) {
  const categories = countByCategory(resources).sort((a, b) => b.count - a.count);
  return (
    <ul className="flex flex-col">
      {categories.map(({ category, count }) => {
        const { label, icon: Icon, tint } = CATEGORY_META[category];
        const share = (count / resources.length) * 100;
        return (
          <li key={category}>
            <Link
              to={`/library?filter=${category}`}
              className="group/collection flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-md bg-linear-to-br ring-1 ring-white/10",
                  tint,
                )}
              >
                <Icon className="size-3.5 text-tile-icon" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                {label}
              </span>
              <span className="text-xs tabular-nums">{plural(count, "resource")}</span>
              <ShareRing
                percent={share}
                label={`${label}: ${String(Math.round(share))}% of your library`}
                className="size-6"
              />
              <ChevronRight
                className="size-4 text-muted-foreground/60 transition-transform group-hover/collection:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
