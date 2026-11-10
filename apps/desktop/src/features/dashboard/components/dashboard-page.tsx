import { formatDistanceToNowStrict, startOfMonth, subMonths } from "date-fns";
import {
  Activity,
  ArrowRight,
  Bookmark,
  FolderOpen,
  Link2,
  Plus,
  Search,
  Shapes,
  Sparkles,
  Star,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { TrendingPreview } from "@/features/discovery";
import { ResourceCard } from "@/features/library";
import { useLibrary } from "@/hooks/use-library";
import { CATEGORY_META, countByCategory } from "@/lib/resource-categories";
import { cn } from "@/lib/utils";
import type { Resource } from "@/types/library.types";

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

export function DashboardPage() {
  const library = useLibrary();
  const resources = library.data?.resources ?? [];
  const status = library.isPending
    ? "Reading your Brave bookmarks…"
    : library.isError
      ? library.error.message
      : null;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-5 pt-5 pb-8 lg:px-8">
      <WelcomeHero />
      <LibraryBreakdown resources={resources} />

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title="Featured resources" icon={Star} viewAll="/library">
          {status ?? <FeaturedResources resources={resources} />}
        </Panel>
        <Panel title="Quick actions" icon={Zap}>
          <QuickActions />
        </Panel>
      </div>

      <div className="mt-8">
        <Panel title="Trending on GitHub" icon={TrendingUp} viewAll="/discovery">
          <TrendingPreview />
        </Panel>
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title="Your collections" icon={FolderOpen} viewAll="/library">
          {status ?? <Collections resources={resources} />}
        </Panel>
        <Panel title="Recent activity" icon={Activity} viewAll="/library">
          {status ?? <RecentActivity resources={resources} />}
        </Panel>
      </div>
    </div>
  );
}

interface PanelProps {
  title: string;
  icon: LucideIcon;
  viewAll?: string;
  children: ReactNode;
}

function Panel({ title, icon: Icon, viewAll, children }: PanelProps) {
  const id = `panel-${title.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <section aria-labelledby={id} className="min-w-0 text-sm text-muted-foreground">
      <div className="mb-3 flex h-8 items-center justify-between gap-3">
        <h2 id={id} className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
          {title}
        </h2>
        {viewAll !== undefined && (
          <Link
            to={viewAll}
            className="inline-flex items-center gap-1 rounded-md px-1 py-1 text-xs font-medium text-primary outline-none hover:underline hover:underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring"
          >
            View all
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function plural(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? "" : "s"}`;
}

/** What the library holds: totals, one bar split by category, and a way into new links. */
function LibraryBreakdown({ resources }: { resources: readonly Resource[] }) {
  if (resources.length === 0) return null;
  const monthly = monthlyAdditions(resources, new Date());
  const thisMonth = monthly.at(-1) ?? 0;
  const lastMonth = monthly.at(-2) ?? 0;
  const newCount = resources.filter((resource) => resource.isNew).length;
  const categories = countByCategory(resources).sort((a, b) => b.count - a.count);

  return (
    <section
      aria-labelledby="library-breakdown"
      className="mt-5 rounded-xl border border-border bg-card p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <h2 id="library-breakdown" className="text-base font-semibold">
          <span className="text-2xl tracking-tight tabular-nums">{resources.length}</span>{" "}
          {resources.length === 1 ? "resource" : "resources"}
        </h2>
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground tabular-nums">
            {thisMonth} saved this month · {lastMonth} last month
          </p>
          {newCount > 0 && (
            <Link
              to="/library?filter=new"
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border bg-secondary px-3 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span aria-hidden className="size-2 rounded-full bg-highlight" />
              Review {plural(newCount, "new link")}
            </Link>
          )}
        </div>
      </div>

      {/* Segments repeat the legend's links for the mouse; keyboard users get the legend. */}
      <div aria-hidden className="mt-4 flex h-3 gap-0.5 overflow-hidden rounded-full">
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

      <ul aria-label="Resources by category" className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        {categories.map(({ category, count }) => (
          <li key={category}>
            <Link
              to={`/library?filter=${category}`}
              className="inline-flex items-center gap-2 rounded text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                aria-hidden
                className={cn("size-2.5 rounded-sm", CATEGORY_META[category].swatch)}
              />
              {CATEGORY_META[category].label}
              <span className="font-medium text-foreground tabular-nums">{count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function newestFirst(resources: readonly Resource[]): Resource[] {
  return [...resources].sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0));
}

function FeaturedResources({ resources }: { resources: readonly Resource[] }) {
  const featured = newestFirst(resources).slice(0, 4);
  if (featured.length === 0) return <p>Save links in Brave › develop or with Add link.</p>;
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-3">
      {featured.map((resource) => (
        <li key={resource.id}>
          <ResourceCard resource={resource} />
        </li>
      ))}
    </ul>
  );
}

const QUICK_ACTIONS: { label: string; to: string; icon: LucideIcon }[] = [
  { label: "Search library", to: "/library", icon: Search },
  { label: "Add a link", to: "/library?add=1", icon: Plus },
  { label: "New resources", to: "/library?filter=new", icon: Sparkles },
  { label: "UI components", to: "/library?filter=ui-components", icon: Shapes },
  { label: "Inspiration", to: "/library?filter=inspiration", icon: Star },
  { label: "Cloud consoles", to: "/library?filter=cloud", icon: Link2 },
];

function QuickActions() {
  return (
    <ul className="grid grid-cols-3 gap-2.5">
      {QUICK_ACTIONS.map(({ label, to, icon: Icon }) => (
        <li key={label}>
          <Link
            to={to}
            className="group/action flex h-full flex-col items-center gap-2 rounded-xl border border-border bg-card px-2 py-3.5 text-center text-xs text-foreground/85 transition-[background-color,border-color,transform] duration-150 outline-none hover:border-primary/50 hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] motion-reduce:active:scale-100"
          >
            <Icon
              className="size-5 text-muted-foreground transition-colors group-hover/action:text-primary"
              aria-hidden
            />
            {label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Collections({ resources }: { resources: readonly Resource[] }) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] gap-3">
      {countByCategory(resources).map(({ category, count }) => {
        const { label, icon: Icon, tint } = CATEGORY_META[category];
        return (
          <li key={category}>
            <Link
              to={`/library?filter=${category}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-[background-color,border-color] duration-150 outline-none hover:border-white/15 hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-lg bg-linear-to-br ring-1 ring-white/10",
                  tint,
                )}
              >
                <Icon className="size-5 text-white" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-medium text-foreground">{label}</span>
                <span className="text-xs">{count} resources</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function RecentActivity({ resources }: { resources: readonly Resource[] }) {
  const recent = newestFirst(resources)
    .filter((resource) => resource.addedAt !== null)
    .slice(0, 5);
  if (recent.length === 0) return <p>Nothing saved yet.</p>;
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {recent.map((resource) => {
        const added = resource.origin === "devatlas";
        const Icon = added ? Plus : Bookmark;
        return (
          <li key={resource.id} className="flex items-center gap-3 px-3 py-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary">
              <Icon className="size-3.5 text-muted-foreground" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 truncate">
              {added ? "Added " : "Saved "}
              <Link
                to={`/library/${encodeURIComponent(resource.id)}`}
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
