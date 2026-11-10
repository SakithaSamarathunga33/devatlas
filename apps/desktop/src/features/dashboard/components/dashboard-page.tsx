import { formatDistanceToNowStrict, startOfMonth, subMonths } from "date-fns";
import {
  Activity,
  ArrowRight,
  Bookmark,
  CalendarPlus,
  FolderOpen,
  Layers,
  Link2,
  Plus,
  Search,
  Shapes,
  Sparkles,
  Star,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

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
      <StatCards resources={resources} />

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel title="Featured resources" icon={Star} viewAll="/library">
          {status ?? <FeaturedResources resources={resources} />}
        </Panel>
        <Panel title="Quick actions" icon={Zap}>
          <QuickActions />
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
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
    <section
      aria-labelledby={id}
      className="rounded-2xl border border-white/[0.06] bg-card/70 p-5 text-sm text-muted-foreground backdrop-blur"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={id} className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Icon className="size-[18px] text-primary" aria-hidden />
          {title}
        </h2>
        {viewAll !== undefined && (
          <Link
            to={viewAll}
            className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-violet-300 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-ring"
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

function StatCards({ resources }: { resources: readonly Resource[] }) {
  const monthly = monthlyAdditions(resources, new Date());
  const thisMonth = monthly.at(-1) ?? 0;
  const lastMonth = monthly.at(-2) ?? 0;
  const olderThanWindow = resources.length - monthly.reduce((sum, count) => sum + count, 0);
  const cumulative = monthly.reduce<number[]>(
    (totals, count) => [...totals, (totals.at(-1) ?? olderThanWindow) + count],
    [],
  );
  const categories = countByCategory(resources);

  const stats: StatProps[] = [
    {
      label: "Total resources",
      value: resources.length,
      note: `+${String(thisMonth)} this month`,
      icon: Layers,
      tone: "text-amber-300",
      series: cumulative,
    },
    {
      label: "Saved this month",
      value: thisMonth,
      note: `${String(lastMonth)} last month`,
      icon: CalendarPlus,
      tone: "text-violet-300",
      series: monthly,
    },
    {
      label: "New for you",
      value: resources.filter((resource) => resource.isNew).length,
      note: "Not opened yet",
      icon: Sparkles,
      tone: "text-emerald-300",
      series: [],
    },
    {
      label: "Categories",
      value: categories.length,
      note: `${String(resources.filter((r) => r.origin === "devatlas").length)} added in DevAtlas`,
      icon: Shapes,
      tone: "text-sky-300",
      series: categories.map(({ count }) => count),
    },
  ];

  return (
    <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <li key={stat.label}>
          <StatCard {...stat} />
        </li>
      ))}
    </ul>
  );
}

interface StatProps {
  label: string;
  value: number;
  note: string;
  icon: LucideIcon;
  tone: string;
  series: number[];
}

function StatCard({ label, value, note, icon: Icon, tone, series }: StatProps) {
  return (
    <div className="flex items-end justify-between gap-3 rounded-2xl border border-white/[0.06] bg-card/70 p-5 backdrop-blur">
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-1 size-6", tone)} aria-hidden />
        <div>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className={cn("mt-1 text-xs", tone)}>{note}</p>
        </div>
      </div>
      <Sparkline values={series} className={tone} />
    </div>
  );
}

function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const line = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 30 - (value / max) * 26;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      aria-hidden
      className={cn("h-12 w-28 shrink-0", className)}
    >
      <path d={`${line} L100,32 L0,32 Z`} fill="currentColor" opacity={0.12} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
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
            className="flex h-full flex-col items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 py-3.5 text-center text-xs text-foreground/85 transition-colors outline-none hover:border-primary/40 hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon className="size-5 text-violet-300" aria-hidden />
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
              className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 outline-none hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-ring"
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
    <ul className="space-y-3">
      {recent.map((resource) => {
        const added = resource.origin === "devatlas";
        const Icon = added ? Plus : Bookmark;
        return (
          <li key={resource.id} className="flex items-center gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/15">
              <Icon className="size-3.5 text-violet-300" aria-hidden />
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
            <time className="shrink-0 text-xs">
              {formatDistanceToNowStrict(resource.addedAt ?? 0, { addSuffix: true })}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
