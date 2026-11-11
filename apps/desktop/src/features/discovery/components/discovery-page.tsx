import { Bookmark, Flame, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router";

import { GooeyFilter } from "@/components/shared/gooey-filter";
import { PageHeader } from "@/components/shared/page-header";
import { SearchField } from "@/components/shared/search-field";
import { useLibrary } from "@/hooks/use-library";
import { selectClass } from "@/lib/styles";
import { cn } from "@/lib/utils";
import {
  starBoardViews,
  trendingPeriods,
  type GithubRepo,
  type StarBoardView,
  type TrendingPeriod,
} from "@/types/discovery.types";

import { useTrendingRepos } from "../hooks/use-trending-repos";
import { githubFullName, LANGUAGES, libraryId, type Language } from "../repo-utils";
import { REPO_LIST, RepoListError, RepoListSkeleton, RepoRow, SaveRepoButton } from "./repo-ui";
import { SavedRepos } from "./saved-repos";
import { StarBoardsView } from "./star-boards";

const PERIOD_LABELS: Record<TrendingPeriod, { button: string; phrase: string }> = {
  day: { button: "Today", phrase: "today" },
  week: { button: "This week", phrase: "this week" },
  month: { button: "This month", phrase: "this month" },
};

const BOARD_LABELS: Record<StarBoardView, string> = {
  weekly: "Weekly",
  alltime: "All-time",
  random: "Random",
  pyramid: "Pyramid",
};

type Section = "trending" | "stars" | "saved";

const SEARCH_LABELS: Record<Section, string> = {
  trending: "Search new repositories",
  stars: "Search Star History repositories",
  saved: "Search saved repositories",
};

function parseSection(value: string | null): Section {
  return value === "saved" || value === "stars" ? value : "trending";
}

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

/** Discovery: trending GitHub repositories, star-history.com's rankings and the repositories
 * saved in the library. Section, period, ranking, language and search live in the URL
 * (`?view=stars&board=alltime&q=agent`). */
export function DiscoveryPage() {
  const [params, setParams] = useSearchParams();
  const section = parseSection(params.get("view"));
  const board = starBoardViews.find((view) => view === params.get("board")) ?? "weekly";
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
    <div className="w-full px-5 pt-5 pb-16 lg:px-8">
      <PageHeader
        title="Repos"
        description={
          {
            trending: `New GitHub repositories collecting the most stars ${PERIOD_LABELS[period].phrase}.`,
            stars: "GitHub's biggest star gainers and most-starred repositories of any age.",
            saved:
              "GitHub repositories in your library, with their language and stars from GitHub.",
          }[section]
        }
      >
        <div
          role="group"
          aria-label="Show"
          className="flex shrink-0 rounded-xl border border-border bg-card p-1"
        >
          <SectionButton
            active={section === "trending"}
            onSelect={() => {
              setParam("view", null);
            }}
          >
            <Flame aria-hidden />
            New
          </SectionButton>
          <SectionButton
            active={section === "stars"}
            onSelect={() => {
              setParam("view", "stars");
            }}
          >
            <Trophy aria-hidden />
            Star History
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
      </PageHeader>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!(section === "stars" && board === "pyramid") && (
          <SearchField
            value={search}
            onChange={(value) => {
              setParam("q", value);
            }}
            label={SEARCH_LABELS[section]}
            placeholder="Search repositories…"
          />
        )}
        {section === "stars" && (
          <GooeyFilter
            label="Ranking"
            value={board}
            onChange={(value) => {
              setParam("board", value === "weekly" ? null : value);
            }}
            options={starBoardViews.map((value) => ({ value, label: BOARD_LABELS[value] }))}
          />
        )}
        {section === "trending" && (
          <>
            <GooeyFilter
              label="Period"
              value={period}
              onChange={(value) => {
                setParam("period", value === "week" ? null : value);
              }}
              options={trendingPeriods.map((value) => ({
                value,
                label: PERIOD_LABELS[value].button,
              }))}
            />
            <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
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
          </>
        )}
      </div>

      {section === "trending" && (
        <TrendingList
          period={period}
          language={language}
          search={search}
          isSaved={(repo) => savedIds.has(libraryId(repo.fullName))}
        />
      )}
      {section === "stars" && (
        <StarBoardsView
          view={board}
          search={search}
          isSaved={(fullName) => savedIds.has(libraryId(fullName))}
        />
      )}
      {section === "saved" && <SavedRepos search={search} />}
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

  if (repos.isPending) return <RepoListSkeleton label="Loading trending repositories" />;
  if (repos.isError) {
    return <RepoListError title="New repositories unavailable" query={repos} />;
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
        No new repositories match &ldquo;{search}&rdquo;.
      </p>
    );
  }
  return (
    <ol aria-label="New repositories" className={cn("mt-4", REPO_LIST)}>
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
