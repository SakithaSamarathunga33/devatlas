import { Bookmark, CalendarDays, CircleAlert, Flame, RotateCw } from "lucide-react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router";

import { SearchField } from "@/components/shared/search-field";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLibrary } from "@/hooks/use-library";
import { selectClass } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { trendingPeriods, type GithubRepo, type TrendingPeriod } from "@/types/discovery.types";

import { useTrendingRepos } from "../hooks/use-trending-repos";
import { githubFullName, LANGUAGES, libraryId, type Language } from "../repo-utils";
import { GithubMark, RepoRow, SaveRepoButton } from "./repo-ui";
import { SavedRepos } from "./saved-repos";

const PERIOD_LABELS: Record<TrendingPeriod, { button: string; phrase: string }> = {
  day: { button: "Today", phrase: "today" },
  week: { button: "This week", phrase: "this week" },
  month: { button: "This month", phrase: "this month" },
};

type Section = "trending" | "saved";

function parsePeriod(value: string | null): TrendingPeriod {
  return trendingPeriods.find((period) => period === value) ?? "week";
}

function parseLanguage(value: string | null): Language | null {
  return LANGUAGES.find((language) => language === value) ?? null;
}

function matches(repo: GithubRepo, term: string): boolean {
  if (term === "") return true;
  return [repo.fullName, repo.description ?? "", repo.language ?? ""].some((text) =>
    text.toLowerCase().includes(term),
  );
}

/** Discovery: trending GitHub repositories and the ones saved in the library. Section,
 * period, language and search live in the URL (`?view=saved&period=month&q=agent`). */
export function DiscoveryPage() {
  const [params, setParams] = useSearchParams();
  const section: Section = params.get("view") === "saved" ? "saved" : "trending";
  const period = parsePeriod(params.get("period"));
  const language = parseLanguage(params.get("language"));
  const search = params.get("q") ?? "";
  const library = useLibrary();
  const resources = library.data?.resources ?? [];
  const savedIds = new Set(resources.map((resource) => resource.id.toLowerCase()));
  const savedCount = resources.filter((resource) => githubFullName(resource.url) !== null).length;

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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-card">
            <GithubMark className="size-6" />
          </span>
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.025em]">Discovery</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {section === "trending"
                ? `New GitHub repositories collecting the most stars ${PERIOD_LABELS[period].phrase}. Save the ones worth keeping to your library.`
                : "GitHub repositories in your library, with their language and stars from GitHub."}
            </p>
          </div>
        </div>
        <div
          role="group"
          aria-label="Show"
          className="flex shrink-0 self-start rounded-xl border border-border bg-card p-1 lg:self-auto"
        >
          <SectionButton
            active={section === "trending"}
            onSelect={() => {
              setParam("view", null);
            }}
          >
            <Flame aria-hidden />
            Trending
          </SectionButton>
          <SectionButton
            active={section === "saved"}
            onSelect={() => {
              setParam("view", "saved");
            }}
          >
            <Bookmark aria-hidden />
            Saved repos
            <span
              className={cn(
                "rounded-full px-1.5 text-xs tabular-nums",
                section === "saved" ? "bg-primary-foreground/15" : "bg-secondary",
              )}
            >
              {savedCount}
            </span>
          </SectionButton>
        </div>
      </div>

      <div className="mt-5 flex">
        <SearchField
          value={search}
          onChange={(value) => {
            setParam("q", value);
          }}
          label={
            section === "trending" ? "Search trending repositories" : "Search saved repositories"
          }
          placeholder="Search repositories, descriptions, or languages…"
        />
      </div>

      {section === "trending" ? (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div role="group" aria-label="Period" className="flex flex-wrap gap-2">
              {trendingPeriods.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={period === value}
                  onClick={() => {
                    setParam("period", value === "week" ? null : value);
                  }}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm transition-[background-color,color] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    period === value
                      ? "border-transparent bg-primary font-medium text-primary-foreground"
                      : "border-border bg-card text-foreground/80 hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <CalendarDays className="size-4" aria-hidden />
                  {PERIOD_LABELS[value].button}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Language
              <select
                value={language ?? ""}
                onChange={(event) => {
                  setParam("language", event.target.value);
                }}
                className={selectClass}
              >
                <option value="">All languages</option>
                {LANGUAGES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <TrendingList
            period={period}
            language={language}
            search={search}
            isSaved={(repo) => savedIds.has(libraryId(repo.fullName))}
          />
        </>
      ) : (
        <SavedRepos search={search} />
      )}
    </div>
  );
}

function SectionButton({
  active,
  onSelect,
  children,
}: {
  active: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&>svg]:size-4",
        active
          ? "bg-primary font-medium text-primary-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

interface TrendingListProps {
  period: TrendingPeriod;
  language: Language | null;
  search: string;
  isSaved: (repo: GithubRepo) => boolean;
}

function TrendingList({ period, language, search, isSaved }: TrendingListProps) {
  const repos = useTrendingRepos(period, language);

  if (repos.isPending) return <RepoListSkeleton />;
  if (repos.isError) {
    return (
      <div role="alert" className="mt-8 flex flex-col items-start gap-3">
        <p className="flex items-center gap-2 text-sm font-medium text-destructive">
          <CircleAlert className="size-4" aria-hidden />
          Trending repositories unavailable
        </p>
        <p className="text-sm text-muted-foreground">
          {repos.error.message.replace(/^.*?failed: /, "")}
        </p>
        <Button variant="outline" onClick={() => void repos.refetch()} disabled={repos.isFetching}>
          <RotateCw aria-hidden />
          Try again
        </Button>
      </div>
    );
  }
  if (repos.data.length === 0) {
    return (
      <p className="mt-8 text-sm text-muted-foreground">
        No new {language === null ? "" : `${language} `}repositories gained stars{" "}
        {PERIOD_LABELS[period].phrase}. Try a longer period or another language.
      </p>
    );
  }

  const term = search.trim().toLowerCase();
  // Ranks come from GitHub's order, so they stay put while searching.
  const ranked = repos.data
    .map((repo, index) => ({ repo, rank: index + 1 }))
    .filter(({ repo }) => matches(repo, term));

  if (ranked.length === 0) {
    return (
      <p className="mt-8 text-sm text-muted-foreground">
        No trending repositories match &ldquo;{search}&rdquo;.
      </p>
    );
  }
  return (
    <ol aria-label="Trending repositories" className="mt-4 space-y-2">
      {ranked.map(({ repo, rank }) => (
        <li key={repo.fullName}>
          <RepoRow
            fullName={repo.fullName}
            url={repo.url}
            details={repo}
            rank={rank}
            action={<SaveRepoButton repo={repo} saved={isSaved(repo)} />}
          />
        </li>
      ))}
    </ol>
  );
}

function RepoListSkeleton() {
  return (
    <div role="status" aria-busy="true" className="mt-4 space-y-2">
      <span className="sr-only">Loading trending repositories</span>
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 rounded-xl border border-border bg-card p-3"
        >
          <Skeleton className="size-9 rounded-lg" />
          <Skeleton className="size-12 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
