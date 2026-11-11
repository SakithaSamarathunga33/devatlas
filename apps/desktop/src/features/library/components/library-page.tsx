import { CircleAlert, LayoutGrid, List, Plus, RotateCw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";

import { GooeyFilter } from "@/components/shared/gooey-filter";
import { PageHeader } from "@/components/shared/page-header";
import { SearchField } from "@/components/shared/search-field";
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
    <div className="w-full px-5 pt-5 pb-16 lg:px-8">
      <PageHeader
        title="Library"
        description={
          query.isSuccess
            ? librarySummary(query.data)
            : "Your developer bookmarks, read live from Brave."
        }
      >
        <div className="flex max-w-xl min-w-0 flex-1 basis-80 items-center gap-2">
          <SearchField
            value={params.get("q") ?? ""}
            onChange={(value) => {
              setParam("q", value);
            }}
            label="Search library"
            placeholder="Search…"
          />
          {query.isSuccess && query.data.resources.length > 0 && (
            <div
              role="group"
              aria-label="Layout"
              className="flex shrink-0 rounded-lg border border-border bg-card p-px"
            >
              <ViewButton
                label="Grid view"
                active={view === "grid"}
                onSelect={() => {
                  setView("grid");
                }}
              >
                <LayoutGrid aria-hidden />
              </ViewButton>
              <ViewButton
                label="List view"
                active={view === "list"}
                onSelect={() => {
                  setView("list");
                }}
              >
                <List aria-hidden />
              </ViewButton>
            </div>
          )}
          <button
            type="button"
            aria-expanded={adding}
            aria-controls="add-link-panel"
            onClick={() => {
              setParam("add", adding ? null : "1");
            }}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors outline-none hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
      </PageHeader>
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
        />
      )}
    </div>
  );
}

interface LibraryBrowserProps {
  snapshot: LibrarySnapshot;
  category: CategoryFilter;
  onCategoryChange: (category: CategoryFilter) => void;
  search: string;
  view: View;
}

function LibraryBrowser({
  snapshot,
  category,
  onCategoryChange,
  search,
  view,
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
      <div className="mt-4">
        <GooeyFilter
          label="Filter by category"
          value={category}
          onChange={onCategoryChange}
          options={[
            { value: "all", label: "All", count: snapshot.resources.length },
            ...(newCount > 0 ? [{ value: "new" as const, label: "New", count: newCount }] : []),
            ...countByCategory(snapshot.resources).map(({ category: value, count }) => ({
              value,
              label: CATEGORY_META[value].label,
              count,
            })),
          ]}
        />
      </div>

      {groups.length === 0 && (
        <p className="mt-10 text-sm text-muted-foreground">No resources match “{search}”.</p>
      )}

      {groups.map(({ category: group, items }) => {
        const { label, icon: Icon } = CATEGORY_META[group];
        return (
          <section key={group} aria-labelledby={`category-${group}`} className="mt-7">
            <div className="flex items-center gap-2">
              <Icon className="size-4 text-primary" aria-hidden />
              <h2 id={`category-${group}`} className="text-base font-semibold">
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
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
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
