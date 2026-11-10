import { CircleAlert, LayoutGrid, List, Plus, RotateCw, Search } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLibrary } from "@/hooks/use-library";
import { CATEGORY_META, countByCategory } from "@/lib/resource-categories";
import { cn } from "@/lib/utils";
import {
  resourceCategories,
  type LibrarySnapshot,
  type ResourceCategory,
} from "@/types/library.types";

import { AddLinkForm } from "./add-link-form";
import { ResourceCard } from "./resource-card";
import { ResourceRow } from "./resource-row";

type CategoryFilter = ResourceCategory | "all" | "new";
type View = "grid" | "list";

function parseFilter(value: string | null): CategoryFilter {
  if (value === "new") return "new";
  return resourceCategories.find((category) => category === value) ?? "all";
}

function librarySummary({ source, resources }: LibrarySnapshot): string {
  const fromBrowser = resources.filter((resource) => resource.origin === "browser").length;
  const added = resources.length - fromBrowser;
  const browserPart = `${String(fromBrowser)} from ${source.browser} › ${source.folder}`;
  return added === 0
    ? `${String(resources.length)} developer resources: ${browserPart}, read live from your bookmarks.`
    : `${String(resources.length)} developer resources: ${browserPart}, and ${String(added)} added in DevAtlas.`;
}

/** The library. Search (`q`), category (`filter`) and the add-link panel (`add`) live in
 * the URL, so the dashboard and the header search can link straight into a view. */
export function LibraryPage() {
  const [params, setParams] = useSearchParams();
  const query = useLibrary();
  const [view, setView] = useState<View>("grid");
  const adding = params.get("add") === "1";

  const setParam = (key: string, value: string | null) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  };

  return (
    <div className="w-full px-5 pt-6 pb-16 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-[-0.025em]">Library</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {query.isSuccess
          ? librarySummary(query.data)
          : "Your developer bookmarks, read live from Brave."}
      </p>

      <div className="mt-5 flex items-center gap-3">
        <SearchField
          value={params.get("q") ?? ""}
          onChange={(value) => {
            setParam("q", value);
          }}
        />
        <button
          type="button"
          aria-expanded={adding}
          aria-controls="add-link-panel"
          onClick={() => {
            setParam("add", adding ? null : "1");
          }}
          className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_1px_2px_rgb(0_0_0/0.4)] transition-[background-color,transform] duration-150 outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.97] motion-reduce:active:scale-100"
        >
          <Plus
            aria-hidden
            className={cn(
              "size-4 transition-transform motion-reduce:transition-none",
              adding && "rotate-45",
            )}
          />
          Add link
        </button>
      </div>
      {adding && (
        <div id="add-link-panel">
          <AddLinkForm autoFocus />
        </div>
      )}

      {query.isPending && <LibrarySkeleton />}

      {query.isError && (
        <div role="alert" className="mt-10 flex flex-col items-start gap-3">
          <p className="flex items-center gap-2 text-sm font-medium text-destructive">
            <CircleAlert className="size-4" aria-hidden />
            Library unavailable
          </p>
          <p className="text-sm text-muted-foreground">{query.error.message}</p>
          <Button
            variant="outline"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            <RotateCw aria-hidden />
            Try again
          </Button>
        </div>
      )}

      {query.isSuccess && (
        <LibraryBrowser
          snapshot={query.data}
          category={parseFilter(params.get("filter"))}
          onCategoryChange={(value) => {
            setParam("filter", value === "all" ? null : value);
          }}
          search={params.get("q") ?? ""}
          view={view}
          onViewChange={setView}
        />
      )}
    </div>
  );
}

function SearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="relative block max-w-3xl flex-1">
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-muted-foreground"
      />
      <input
        data-search-shortcut
        type="search"
        aria-label="Search library"
        placeholder="Search resources, tools, or topics…"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="h-12 w-full rounded-xl border border-input bg-card pr-24 pl-11 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/30"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-1 font-sans text-[11px] text-muted-foreground">
        <span className="rounded border border-input bg-secondary px-1.5 py-0.5">Ctrl</span>+
        <span className="rounded border border-input bg-secondary px-1.5 py-0.5">K</span>
      </kbd>
    </label>
  );
}

interface LibraryBrowserProps {
  snapshot: LibrarySnapshot;
  category: CategoryFilter;
  onCategoryChange: (category: CategoryFilter) => void;
  search: string;
  view: View;
  onViewChange: (view: View) => void;
}

function LibraryBrowser({
  snapshot,
  category,
  onCategoryChange,
  search,
  view,
  onViewChange,
}: LibraryBrowserProps) {
  if (snapshot.resources.length === 0) {
    return (
      <p className="mt-10 text-sm text-muted-foreground">
        No bookmarks found in {snapshot.source.browser} › {snapshot.source.folder}. Save links into
        that folder and they appear here.
      </p>
    );
  }

  const newCount = snapshot.resources.filter((resource) => resource.isNew).length;
  const term = search.trim().toLowerCase();
  const visible = snapshot.resources.filter(
    (resource) =>
      (category === "all" ||
        (category === "new" ? resource.isNew : resource.category === category)) &&
      (term === "" || resource.title.toLowerCase().includes(term) || resource.host.includes(term)),
  );
  const groups = resourceCategories
    .map((group) => ({
      category: group,
      // New resources first; the stable sort keeps the title order otherwise.
      items: visible
        .filter((resource) => resource.category === group)
        .sort((a, b) => Number(b.isNew) - Number(a.isNew)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      <div className="mt-5 flex items-start justify-between gap-4">
        <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2">
          <FilterChip
            label="All"
            count={snapshot.resources.length}
            active={category === "all"}
            onSelect={() => {
              onCategoryChange("all");
            }}
          />
          {newCount > 0 && (
            <FilterChip
              label="New"
              count={newCount}
              active={category === "new"}
              onSelect={() => {
                onCategoryChange("new");
              }}
            />
          )}
          {countByCategory(snapshot.resources).map(({ category: value, count }) => (
            <FilterChip
              key={value}
              label={CATEGORY_META[value].label}
              count={count}
              active={category === value}
              onSelect={() => {
                onCategoryChange(value);
              }}
            />
          ))}
        </div>
        <div
          role="group"
          aria-label="Layout"
          className="flex shrink-0 rounded-lg border border-border bg-card p-0.5"
        >
          <ViewButton
            label="Grid view"
            active={view === "grid"}
            onSelect={() => {
              onViewChange("grid");
            }}
          >
            <LayoutGrid aria-hidden />
          </ViewButton>
          <ViewButton
            label="List view"
            active={view === "list"}
            onSelect={() => {
              onViewChange("list");
            }}
          >
            <List aria-hidden />
          </ViewButton>
        </div>
      </div>

      {groups.length === 0 && (
        <p className="mt-10 text-sm text-muted-foreground">No resources match “{search}”.</p>
      )}

      {groups.map(({ category: group, items }) => {
        const { label, icon: Icon } = CATEGORY_META[group];
        return (
          <section key={group} aria-labelledby={`category-${group}`} className="mt-9">
            <div className="flex items-center gap-2.5">
              <Icon className="size-4 text-muted-foreground" aria-hidden />
              <h2 id={`category-${group}`} className="text-sm font-semibold">
                {label}
              </h2>
              <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>
            </div>
            {view === "grid" ? (
              <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3">
                {items.map((resource) => (
                  <li key={resource.id}>
                    <ResourceCard resource={resource} />
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card p-1.5">
                {items.map((resource) => (
                  <li key={resource.id}>
                    <ResourceRow resource={resource} />
                  </li>
                ))}
              </ul>
            )}
          </section>
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
        "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-xs font-medium transition-[background-color,color,transform] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] motion-reduce:active:scale-100",
        active
          ? "border-transparent bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground/80 hover:bg-secondary hover:text-foreground",
      )}
    >
      {label}
      <span
        className={cn(
          "tabular-nums",
          active ? "text-primary-foreground/70" : "text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}

interface ViewButtonProps {
  label: string;
  active: boolean;
  onSelect: () => void;
  children: ReactNode;
}

function ViewButton({ label, active, onSelect, children }: ViewButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        "flex size-8 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4",
        active
          ? "bg-secondary text-primary"
          : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Card-shaped placeholders while Brave's bookmarks are read. */
function LibrarySkeleton() {
  return (
    <div role="status" aria-busy="true" className="mt-9">
      <span className="sr-only">Reading your Brave bookmarks</span>
      <Skeleton className="h-5 w-40" />
      <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3">
        {Array.from({ length: 6 }, (_, index) => (
          <li key={index} className="overflow-hidden rounded-xl border border-border bg-card">
            <Skeleton className="aspect-[1200/630] rounded-none" />
            <div className="flex gap-3 p-4">
              <Skeleton className="size-9 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
