import { CircleAlert, RotateCw, Search } from "lucide-react";
import { useState } from "react";

import Loader from "@/components/kokonutui/loader";
import { ShineButton } from "@/components/shared/shine-button";
import { BlurFade } from "@/components/ui/blur-fade";
import { useLibrary } from "@/hooks/use-library";
import { CATEGORY_META, countByCategory } from "@/lib/resource-categories";
import { cn } from "@/lib/utils";
import {
  resourceCategories,
  type LibrarySnapshot,
  type ResourceCategory,
} from "@/types/library.types";

import { ResourceCard } from "./resource-card";

type CategoryFilter = ResourceCategory | "all";

export function LibraryPage() {
  const query = useLibrary();

  return (
    <div className="mx-auto w-full max-w-6xl px-6 pt-8 pb-16 lg:px-10">
      <BlurFade>
        <h1 className="text-3xl font-semibold tracking-[-0.03em]">Library</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {query.isSuccess
            ? `${String(query.data.resources.length)} developer resources from ${query.data.source.browser} › ${query.data.source.folder}, read live from your bookmarks.`
            : "Your developer bookmarks, read live from Brave."}
        </p>
      </BlurFade>

      {query.isPending && (
        <Loader size="md" title="Reading your Brave bookmarks" subtitle="" className="mt-16" />
      )}

      {query.isError && (
        <div role="alert" className="mt-10 flex flex-col items-start gap-3">
          <p className="flex items-center gap-2 text-sm font-medium text-destructive">
            <CircleAlert className="size-4" aria-hidden />
            Library unavailable
          </p>
          <p className="text-sm text-muted-foreground">{query.error.message}</p>
          <ShineButton onClick={() => void query.refetch()} disabled={query.isFetching}>
            <RotateCw aria-hidden />
            Try again
          </ShineButton>
        </div>
      )}

      {query.isSuccess && <LibraryBrowser snapshot={query.data} />}
    </div>
  );
}

function LibraryBrowser({ snapshot }: { snapshot: LibrarySnapshot }) {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState("");

  if (snapshot.resources.length === 0) {
    return (
      <p className="mt-10 text-sm text-muted-foreground">
        No bookmarks found in {snapshot.source.browser} › {snapshot.source.folder}. Save links into
        that folder and they appear here.
      </p>
    );
  }

  const term = search.trim().toLowerCase();
  const visible = snapshot.resources.filter(
    (resource) =>
      (category === "all" || resource.category === category) &&
      (term === "" || resource.title.toLowerCase().includes(term) || resource.host.includes(term)),
  );
  const groups = resourceCategories
    .map((group) => ({
      category: group,
      items: visible.filter((resource) => resource.category === group),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      <BlurFade delay={0.08}>
        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2">
            <FilterChip
              label="All"
              count={snapshot.resources.length}
              active={category === "all"}
              onSelect={() => {
                setCategory("all");
              }}
            />
            {countByCategory(snapshot.resources).map(({ category: value, count }) => (
              <FilterChip
                key={value}
                label={CATEGORY_META[value].label}
                count={count}
                active={category === value}
                onSelect={() => {
                  setCategory(value);
                }}
              />
            ))}
          </div>
          <label className="relative block lg:w-72">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              aria-label="Search library"
              placeholder="Search by name or site"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
              className="h-10 w-full rounded-full border border-white/10 bg-white/[0.03] pr-4 pl-10 text-sm backdrop-blur outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        </div>
      </BlurFade>

      {groups.length === 0 && (
        <p className="mt-10 text-sm text-muted-foreground">No resources match “{search}”.</p>
      )}

      {groups.map(({ category: group, items }, index) => {
        const { label, icon: Icon } = CATEGORY_META[group];
        return (
          <BlurFade key={group} delay={0.12 + index * 0.04}>
            <section aria-labelledby={`category-${group}`} className="mt-10">
              <div className="flex items-center gap-2.5">
                <Icon className="size-4 text-violet-300" aria-hidden />
                <h2 id={`category-${group}`} className="text-sm font-semibold">
                  {label}
                </h2>
                <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>
              </div>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((resource) => (
                  <li key={resource.id}>
                    <ResourceCard resource={resource} />
                  </li>
                ))}
              </ul>
            </section>
          </BlurFade>
        );
      })}
    </>
  );
}

interface FilterChipProps {
  label: string;
  count: number;
  active: boolean;
  onSelect: () => void;
}

function FilterChip({ label, count, active, onSelect }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary/40 bg-primary/15 text-white shadow-[0_0_18px_-6px_var(--color-primary)]"
          : "border-white/10 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
      )}
    >
      {label}
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
}
