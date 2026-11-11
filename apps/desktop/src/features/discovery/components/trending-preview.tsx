import { Banner } from "@astryxdesign/core/Banner";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { List, ListItem } from "@astryxdesign/core/List";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { Star } from "lucide-react";

import { useLibrary } from "@/hooks/use-library";

import { useTrendingRepos } from "../hooks/use-trending-repos";
import { compactNumber, libraryId } from "../repo-utils";
import { LanguagePill, RepoAvatar, RepoName, SaveRepoButton } from "./repo-ui";

const SHOWN = 5;

/** This week's top trending GitHub repositories, for the dashboard. Shares its cache with
 * the Discovery page, so it costs no extra GitHub requests. */
export function TrendingPreview() {
  const repos = useTrendingRepos("week", null);
  const library = useLibrary();
  const savedIds = new Set(library.data?.resources.map((resource) => resource.id.toLowerCase()));

  if (repos.isPending) {
    return (
      <VStack role="status" aria-busy="true" gap={2}>
        <span className="sr-only">Loading trending repositories</span>
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} index={index} height={56} />
        ))}
      </VStack>
    );
  }
  if (repos.isError) {
    return (
      <Banner
        status="error"
        title="Trending repositories aren't available"
        description={repos.error.message.replace(/^.*?failed: /, "")}
      />
    );
  }
  if (repos.data.length === 0) {
    return (
      <EmptyState
        isCompact
        title="Nothing new this week"
        description="No new repositories gained stars this week."
      />
    );
  }

  return (
    <List aria-label="New this week" listStyle="decimal" hasDividers edge="flush">
      {repos.data.slice(0, SHOWN).map((repo) => (
        <ListItem
          key={repo.fullName}
          label={<RepoName fullName={repo.fullName} url={repo.url} />}
          description={repo.description ?? undefined}
          startContent={
            <RepoAvatar fullName={repo.fullName} details={repo} className="size-9 rounded-lg" />
          }
          endContent={
            <HStack gap={3} vAlign="center">
              <div className="hidden items-center gap-3 sm:flex">
                {repo.language !== null && <LanguagePill language={repo.language} />}
                <HStack gap={1} vAlign="center" width={56}>
                  <Icon icon={Star} size="sm" color="secondary" />
                  <Text type="supporting" hasTabularNumbers>
                    {compactNumber.format(repo.stars)}
                  </Text>
                  <span className="sr-only">stars</span>
                </HStack>
              </div>
              <SaveRepoButton repo={repo} saved={savedIds.has(libraryId(repo.fullName))} compact />
            </HStack>
          }
        />
      ))}
    </List>
  );
}
