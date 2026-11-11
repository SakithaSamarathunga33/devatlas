import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { List } from "@astryxdesign/core/List";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Selector } from "@astryxdesign/core/Selector";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Text } from "@astryxdesign/core/Text";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import { VStack } from "@astryxdesign/core/VStack";
import { Bookmark, LayoutGrid, List as ListIcon, Search } from "lucide-react";
import { useState } from "react";

import { FeedError } from "@/features/news";

import { useSavedRepos, type SavedRepo } from "../hooks/use-saved-repos";
import { RepoActivityLine } from "./repo-activity";
import { RemoveRepoButton, RepoCard, RepoRow } from "./repo-ui";

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
const ALL_LANGUAGES = "all";
/** Up to as many cards as fit, each at least 300px, one full-width column when narrow. */
const CARD_GRID = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3";

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
  const [language, setLanguage] = useState(ALL_LANGUAGES);
  const [sort, setSort] = useState<SortOrder>("recent");
  const [view, setView] = useState<View>("grid");

  if (library.isPending) {
    return (
      <div role="status" aria-busy="true" className={CARD_GRID}>
        <VisuallyHidden>Loading saved repositories</VisuallyHidden>
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} height={176} index={index} />
        ))}
      </div>
    );
  }
  if (library.isError) {
    return <FeedError title="Saved repositories unavailable" query={library} />;
  }
  if (repos.length === 0) {
    return (
      <EmptyState
        icon={<Icon icon={Bookmark} />}
        title="No GitHub repositories saved yet."
        description="Press Save on a repository here, or add a github.com repository link with Add link in the Library."
      />
    );
  }

  const languages = [
    ...new Set(repos.flatMap(({ details }) => (details?.language ? [details.language] : []))),
  ].sort();
  const term = search.trim().toLowerCase();
  const visible = repos
    .filter(
      (repo) =>
        (language === ALL_LANGUAGES || repo.details?.language === language) && matches(repo, term),
    )
    .sort(SORTS[sort].compare);

  return (
    <section aria-labelledby="saved-repos-heading">
      <VisuallyHidden>
        <Heading level={2} id="saved-repos-heading">
          Saved repositories
        </Heading>
      </VisuallyHidden>
      <VStack gap={4}>
        <HStack gap={3} vAlign="center" hAlign="between" wrap="wrap">
          <Text type="supporting" hasTabularNumbers>
            {visible.length === repos.length
              ? `${String(repos.length)} saved ${repos.length === 1 ? "repository" : "repositories"}`
              : `${String(visible.length)} of ${String(repos.length)} saved repositories`}
          </Text>
          <HStack gap={3} vAlign="center" wrap="wrap">
            <Selector
              label="Language"
              isLabelHidden
              value={language}
              onChange={setLanguage}
              options={[{ value: ALL_LANGUAGES, label: "All languages" }, ...languages]}
            />
            <Selector
              label="Sort"
              isLabelHidden
              value={sort}
              onChange={(value) => {
                setSort(parseSort(value));
              }}
              options={SORT_ORDERS.map((value) => ({ value, label: SORTS[value].label }))}
            />
            <SegmentedControl
              label="Layout"
              value={view}
              onChange={(value) => {
                setView(value === "list" ? "list" : "grid");
              }}
            >
              <SegmentedControlItem
                value="grid"
                label="Card view"
                isLabelHidden
                icon={<Icon icon={LayoutGrid} />}
              />
              <SegmentedControlItem
                value="list"
                label="List view"
                isLabelHidden
                icon={<Icon icon={ListIcon} />}
              />
            </SegmentedControl>
          </HStack>
        </HStack>

        {visible.length === 0 ? (
          <EmptyState
            isCompact
            icon={<Icon icon={Search} />}
            title="No saved repositories match these filters."
          />
        ) : view === "grid" ? (
          <ul className={CARD_GRID}>
            {visible.map((repo) => (
              <li key={repo.resource.id}>
                <RepoCard
                  fullName={repo.fullName}
                  url={repo.resource.url}
                  details={repo.details}
                  note={detailsNote(repo)}
                  savedAt={repo.resource.addedAt}
                  activity={<RepoActivityLine fullName={repo.fullName} />}
                  action={<RemoveRepoButton resource={repo.resource} fullName={repo.fullName} />}
                />
              </li>
            ))}
          </ul>
        ) : (
          <List hasDividers>
            {visible.map((repo) => (
              <RepoRow
                key={repo.resource.id}
                fullName={repo.fullName}
                url={repo.resource.url}
                details={repo.details}
                note={detailsNote(repo)}
                activity={<RepoActivityLine fullName={repo.fullName} />}
                action={<RemoveRepoButton resource={repo.resource} fullName={repo.fullName} />}
              />
            ))}
          </List>
        )}
      </VStack>
    </section>
  );
}
