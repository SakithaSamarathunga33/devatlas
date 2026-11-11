import { CircleAlert, LayoutGrid, List } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { selectClass } from "@/lib/styles";
import { cn } from "@/lib/utils";

import { useSavedRepos, type SavedRepo } from "../hooks/use-saved-repos";
import { REPO_LIST, RemoveRepoButton, RepoCard, RepoRow } from "./repo-ui";

const SORTS = {
  recent: {
    label: "Recently saved",
    compare: (a: SavedRepo, b: SavedRepo) => (b.resource.addedAt ?? 0) - (a.resource.addedAt ?? 0),
  },
  stars: {
    label: "Most stars",
    compare: (a: SavedRepo, b: SavedRepo) => (b.details?.stars ?? -1) - (a.details?.stars ?? -1),
  },
  name: {
    label: "Name",
    compare: (a: SavedRepo, b: SavedRepo) => a.fullName.localeCompare(b.fullName),
  },
} as const;
type SortOrder = keyof typeof SORTS;
const SORT_ORDERS = Object.keys(SORTS) as SortOrder[];
type View = "grid" | "list";

function parseSort(value: string): SortOrder {
  return SORT_ORDERS.find((order) => order === value) ?? "recent";
}

function detailsNote(repo: SavedRepo): string | undefined {
  if (repo.detailsFailed) return "Details from GitHub are unavailable right now.";
  if (repo.details === undefined) return "Loading details from GitHub…";
  return undefined;
}

function matches(repo: SavedRepo, term: string): boolean {
  if (term === "") return true;
  return [repo.fullName, repo.details?.description ?? "", repo.details?.language ?? ""].some(
    (text) => text.toLowerCase().includes(term),
  );
}

/** GitHub repositories saved in the library, as cards or rows, with search and filters. */
export function SavedRepos({ search }: { search: string }) {
  const { library, repos } = useSavedRepos();
  const [language, setLanguage] = useState("");
  const [sort, setSort] = useState<SortOrder>("recent");
  const [view, setView] = useState<View>("grid");

  if (library.isPending) {
    return (
      <div role="status" aria-busy="true" className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <span className="sr-only">Loading saved repositories</span>
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-44 rounded-xl" />
        ))}
      </div>
    );
  }
  if (library.isError) {
    return (
      <p role="alert" className="mt-8 flex items-center gap-2 text-sm text-destructive">
        <CircleAlert className="size-4" aria-hidden />
        {library.error.message}
      </p>
    );
  }
  if (repos.length === 0) {
    return (
      <p className="mt-8 max-w-[65ch] text-sm text-muted-foreground">
        No GitHub repositories saved yet. Press Save on a trending repository, or save a github.com
        repository link in Brave › develop or with Add link in the Library.
      </p>
    );
  }

  const languages = [
    ...new Set(repos.flatMap(({ details }) => (details?.language ? [details.language] : []))),
  ].sort();
  const term = search.trim().toLowerCase();
  const visible = repos
    .filter(
      (repo) => (language === "" || repo.details?.language === language) && matches(repo, term),
    )
    .sort(SORTS[sort].compare);

  return (
    <section aria-labelledby="saved-repos-heading" className="mt-5">
      <h2 id="saved-repos-heading" className="sr-only">
        Saved repositories
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground tabular-nums">
          {visible.length === repos.length
            ? `${String(repos.length)} saved ${repos.length === 1 ? "repository" : "repositories"}`
            : `${String(visible.length)} of ${String(repos.length)} saved repositories`}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Language
            <select
              value={language}
              onChange={(event) => {
                setLanguage(event.target.value);
              }}
              className={selectClass}
            >
              <option value="">All languages</option>
              {languages.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Sort
            <select
              value={sort}
              onChange={(event) => {
                setSort(parseSort(event.target.value));
              }}
              className={selectClass}
            >
              {SORT_ORDERS.map((value) => (
                <option key={value} value={value}>
                  {SORTS[value].label}
                </option>
              ))}
            </select>
          </label>
          <div
            role="group"
            aria-label="Layout"
            className="flex rounded-lg border border-border bg-card p-0.5"
          >
            <ViewButton
              label="Card view"
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
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          No saved repositories match these filters.
        </p>
      ) : view === "grid" ? (
        <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3">
          {visible.map((repo) => (
            <li key={repo.resource.id}>
              <RepoCard
                fullName={repo.fullName}
                url={repo.resource.url}
                details={repo.details}
                note={detailsNote(repo)}
                savedAt={repo.resource.addedAt}
                action={<RemoveRepoButton resource={repo.resource} fullName={repo.fullName} />}
              />
            </li>
          ))}
        </ul>
      ) : (
        <ul className={cn("mt-4", REPO_LIST)}>
          {visible.map((repo) => (
            <li key={repo.resource.id}>
              <RepoRow
                fullName={repo.fullName}
                url={repo.resource.url}
                details={repo.details}
                note={detailsNote(repo)}
                action={<RemoveRepoButton resource={repo.resource} fullName={repo.fullName} />}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ViewButton({
  label,
  active,
  onSelect,
  children,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
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
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
