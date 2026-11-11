import { EmptyState } from "@astryxdesign/core/EmptyState";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { List } from "@astryxdesign/core/List";
import { Selector } from "@astryxdesign/core/Selector";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { Bookmark, Flame, Search, Trophy } from "lucide-react";
import { useSearchParams } from "react-router";

import { ForYouToggle } from "@/components/shared/for-you-toggle";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { SearchField } from "@/components/shared/search-field";
import { useInterests } from "@/hooks/use-interests";
import { useLibrary } from "@/hooks/use-library";
import { interestMatcher } from "@/lib/interests";
import {
  starBoardViews,
  trendingPeriods,
  type GithubRepo,
  type StarBoardView,
  type TrendingPeriod,
} from "@/types/discovery.types";

import { useTrendingRepos } from "../hooks/use-trending-repos";
import { githubFullName, LANGUAGES, libraryId, type Language } from "../repo-utils";
import { RepoListError, RepoListSkeleton, RepoRow, SaveRepoButton } from "./repo-ui";
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

const ALL_LANGUAGES = "all";

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
  const interests = useInterests();
  const forYou = params.get("for") === "me" && interests.length > 0;
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
    <VStack padding={6}>
      <VStack gap={4}>
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
        />

        <TabList
          aria-label="Show"
          hasDivider
          value={section}
          onChange={(value) => {
            setParam("view", value === "trending" ? null : value);
          }}
        >
          <Tab value="trending" label="New" icon={<Icon icon={Flame} />} />
          <Tab value="stars" label="Star History" icon={<Icon icon={Trophy} />} />
          <Tab
            value="saved"
            label="Saved repos"
            icon={<Icon icon={Bookmark} />}
            endContent={
              <Text type="supporting" hasTabularNumbers>
                {savedCount}
              </Text>
            }
          />
        </TabList>

        <HStack gap={3} vAlign="center" wrap="wrap">
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
            <FilterTabs
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
              <ForYouToggle
                active={forYou}
                disabled={interests.length === 0}
                onToggle={() => {
                  setParam("for", forYou ? null : "me");
                }}
              />
              <FilterTabs
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
              <div className="ml-auto">
                <Selector
                  label="Language"
                  isLabelHidden
                  value={language ?? ALL_LANGUAGES}
                  onChange={(value) => {
                    setParam("language", value === ALL_LANGUAGES ? null : value);
                  }}
                  options={[{ value: ALL_LANGUAGES, label: "All languages" }, ...LANGUAGES]}
                />
              </div>
            </>
          )}
        </HStack>

        {section === "trending" && (
          <TrendingList
            period={period}
            language={language}
            search={search}
            matches={forYou ? interestMatcher(interests) : undefined}
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
      </VStack>
    </VStack>
  );
}

interface TrendingListProps {
  period: TrendingPeriod;
  language: Language | null;
  search: string;
  /** Narrows the list to what matches the user's interests. */
  matches?: (text: string) => boolean;
  isSaved: (repo: GithubRepo) => boolean;
}

function TrendingList({
  period,
  language,
  search,
  matches: isInteresting,
  isSaved,
}: TrendingListProps) {
  const repos = useTrendingRepos(period, language);

  if (repos.isPending) return <RepoListSkeleton label="Loading trending repositories" />;
  if (repos.isError) {
    return <RepoListError title="New repositories unavailable" query={repos} />;
  }
  if (repos.data.length === 0) {
    return (
      <EmptyState
        icon={<Icon icon={Flame} />}
        title={`No new ${language === null ? "" : `${language} `}repositories gained stars ${PERIOD_LABELS[period].phrase}.`}
        description="Try a longer period or another language."
      />
    );
  }

  const term = search.trim().toLowerCase();
  // Ranks come from GitHub's order, so they stay put while searching.
  const ranked = repos.data
    .map((repo, index) => ({ repo, rank: index + 1 }))
    .filter(({ repo }) => matches(repo, term))
    .filter(
      ({ repo }) =>
        isInteresting === undefined ||
        isInteresting(`${repo.fullName} ${repo.description ?? ""} ${repo.language ?? ""}`),
    );

  if (ranked.length === 0) {
    return (
      <EmptyState
        isCompact
        icon={<Icon icon={Search} />}
        title={`No new repositories match “${search}”.`}
      />
    );
  }
  return (
    <List aria-label="New repositories" hasDividers>
      {ranked.map(({ repo, rank }) => (
        <RepoRow
          key={repo.fullName}
          fullName={repo.fullName}
          url={repo.url}
          details={repo}
          rank={rank}
          action={<SaveRepoButton repo={repo} saved={isSaved(repo)} />}
        />
      ))}
    </List>
  );
}
