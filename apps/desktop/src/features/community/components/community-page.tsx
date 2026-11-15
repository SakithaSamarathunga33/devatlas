import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { Text } from "@astryxdesign/core/Text";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { VStack } from "@astryxdesign/core/VStack";
import { Bot, Globe2, Heart, Share2, Users } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";

import { PageHeader } from "@/components/shared/page-header";
import { SearchField } from "@/components/shared/search-field";
import { RemoteImage } from "@/features/library";
import { FeedError } from "@/features/news";
import type { SetupSummary } from "@/types/agent-setups.types";
import type { SharedSummary } from "@/types/community.types";

import { useSharedSetups } from "../hooks/use-agent-setups";
import {
  useCommunitySession,
  useDebouncedValue,
  useMySharedCollections,
  useSharedCollections,
} from "../hooks/use-community";
import { errorMessage } from "../error-message";
import { followerLabel } from "../follower-label";
import { setupCounts } from "../setup-labels";
import { OwnerAvatar } from "./community-account";
import { CommunitySignInGate } from "./community-sign-in-gate";
import { ShareSetupDialog } from "./share-setup-dialog";

const CARD_GRID = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3";
const SEARCH_DELAY_MS = 300;

type View = "everyone" | "setups" | "mine";

function linkCount(count: number): string {
  return `${String(count)} ${count === 1 ? "link" : "links"}`;
}

/** A published collection; its text is someone else's and is only ever shown as text. */
function CollectionCard({ collection }: { collection: SharedSummary }) {
  const links = linkCount(collection.linkCount);
  return (
    <ClickableCard
      href={`/community/${encodeURIComponent(collection.id)}`}
      label={[
        collection.title,
        `by ${collection.owner.username}`,
        links,
        followerLabel(collection.followerCount),
      ].join(", ")}
      height="100%"
    >
      <VStack gap={3} height="100%" justify="between">
        {collection.coverUrls.length > 0 && (
          <div aria-hidden className="grid grid-cols-3 gap-1 overflow-hidden rounded-lg">
            {/* Copies kept on the Community server: the linked sites never see who looks. */}
            {collection.coverUrls.map((url) => (
              <div key={url} className="aspect-video overflow-hidden bg-(--color-background-muted)">
                <RemoteImage src={url} className="size-full object-cover" fallback={null} />
              </div>
            ))}
          </div>
        )}
        <VStack gap={1}>
          <Heading level={5} accessibilityLevel={2} maxLines={1}>
            {collection.title}
          </Heading>
          {collection.description !== null && (
            <Text type="supporting" maxLines={2}>
              {collection.description}
            </Text>
          )}
        </VStack>
        <HStack gap={2} vAlign="center">
          <OwnerAvatar src={collection.owner.avatarUrl} className="size-5" />
          <div className="min-w-0 flex-1">
            <Text type="supporting" maxLines={1}>
              {collection.owner.username}
            </Text>
          </div>
          <HStack gap={1} vAlign="center">
            <Icon icon={Heart} size="sm" color="secondary" />
            <Text type="supporting" hasTabularNumbers>
              {collection.followerCount}
            </Text>
          </HStack>
          <Text type="supporting" hasTabularNumbers>
            {links} ·{" "}
            <Timestamp value={collection.updatedAt} format="relative" hasTooltip={false} />
          </Text>
        </HStack>
      </VStack>
    </ClickableCard>
  );
}

function GridSkeleton() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading collections</span>
      <div className={CARD_GRID}>
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} index={index} height={112} />
        ))}
      </div>
    </div>
  );
}

function CollectionGrid({ collections }: { collections: readonly SharedSummary[] }) {
  return (
    <ul className={CARD_GRID}>
      {collections.map((collection) => (
        <li key={collection.id}>
          <CollectionCard collection={collection} />
        </li>
      ))}
    </ul>
  );
}

function Everyone({ search }: { search: string }) {
  const query = useDebouncedValue(search, SEARCH_DELAY_MS);
  const collections = useSharedCollections(query);

  if (collections.isPending) return <GridSkeleton />;
  // A failed "Load more" keeps the pages already shown; it is reported below them.
  if (collections.isError && !collections.isFetchNextPageError) {
    return <FeedError title="Community collections couldn't be loaded" query={collections} />;
  }
  // A collection published between two pages can shift one into the next page too.
  const seen = new Set<string>();
  const all = collections.data.pages
    .flatMap((page) => page.collections)
    .filter((collection) => !seen.has(collection.id) && Boolean(seen.add(collection.id)));
  if (all.length === 0) {
    return (
      <EmptyState
        headingLevel={2}
        icon={<Icon icon={Globe2} />}
        title={
          query.trim() === ""
            ? "Nothing has been shared yet"
            : `No collections match “${query.trim()}”`
        }
        description="Share one of your collections from its page to be the first."
      />
    );
  }
  return (
    <VStack gap={4}>
      <CollectionGrid collections={all} />
      {collections.isFetchNextPageError && (
        <Banner
          role="alert"
          status="error"
          title="More collections couldn't be loaded"
          description={errorMessage(collections.error)}
        />
      )}
      {collections.hasNextPage && (
        <HStack hAlign="center">
          <Button
            label="Load more"
            isLoading={collections.isFetchingNextPage}
            onClick={() => {
              void collections.fetchNextPage();
            }}
          />
        </HStack>
      )}
    </VStack>
  );
}

function Mine({ search }: { search: string }) {
  const mine = useMySharedCollections(true);
  const term = search.trim().toLowerCase();

  if (mine.isPending) return <GridSkeleton />;
  if (mine.isError)
    return <FeedError title="Your shared collections couldn't be loaded" query={mine} />;
  const shown = mine.data.filter(
    (collection) =>
      term === "" ||
      collection.title.toLowerCase().includes(term) ||
      (collection.description ?? "").toLowerCase().includes(term),
  );
  if (shown.length === 0) {
    return (
      <EmptyState
        headingLevel={2}
        icon={<Icon icon={Share2} />}
        title={term === "" ? "You haven't shared anything yet" : "None of your collections match"}
        description="Open one of your collections and choose Share to Community."
      />
    );
  }
  return <CollectionGrid collections={shown} />;
}

/** A developer's shared agent setup; its text is someone else's and is only ever shown as text. */
function SetupCard({ setup }: { setup: SetupSummary }) {
  const counts = setupCounts({
    skill: setup.skillCount,
    "mcp-server": setup.mcpServerCount,
    plugin: setup.pluginCount,
  });
  return (
    <ClickableCard
      href={`/community/setups/${encodeURIComponent(setup.owner.id)}`}
      label={`${setup.owner.username}'s agent setup, ${counts}`}
      height="100%"
    >
      <VStack gap={3} height="100%" justify="between">
        <VStack gap={1}>
          <HStack gap={2} vAlign="center">
            <OwnerAvatar src={setup.owner.avatarUrl} className="size-6" />
            <Heading level={5} accessibilityLevel={2} maxLines={1}>
              {setup.owner.username}
            </Heading>
          </HStack>
          {setup.description !== null && (
            <Text type="supporting" maxLines={2}>
              {setup.description}
            </Text>
          )}
        </VStack>
        <Text type="supporting" hasTabularNumbers>
          {counts} · <Timestamp value={setup.updatedAt} format="relative" hasTooltip={false} />
        </Text>
      </VStack>
    </ClickableCard>
  );
}

/** Shared setups, newest first, filtered by name or description among those loaded. */
function SetupList({ search }: { search: string }) {
  const setups = useSharedSetups();
  const session = useCommunitySession();
  const term = search.trim().toLowerCase();
  const userId = session.data?.id ?? null;

  if (setups.isPending) return <GridSkeleton />;
  if (setups.isError && !setups.isFetchNextPageError) {
    return <FeedError title="Shared setups couldn't be loaded" query={setups} />;
  }
  const all = setups.data.pages.flatMap((page) => page.setups);
  const seen = new Set<string>();
  const unique = all.filter((setup) => {
    if (seen.has(setup.owner.id)) return false;
    seen.add(setup.owner.id);
    return true;
  });
  const shown = unique.filter(
    (setup) =>
      term === "" ||
      setup.owner.username.toLowerCase().includes(term) ||
      (setup.description ?? "").toLowerCase().includes(term),
  );
  const isMineShared = userId !== null && all.some((setup) => setup.owner.id === userId);
  let emptyHint: string | undefined;
  if (term !== "") {
    emptyHint = setups.hasNextPage ? "Search looks through the setups loaded so far." : undefined;
  } else if (!isMineShared) {
    emptyHint = "Share yours to be the first.";
  }

  return (
    <VStack gap={4}>
      {shown.length === 0 ? (
        <EmptyState
          headingLevel={2}
          icon={<Icon icon={Bot} />}
          title={
            term === "" ? "No one has shared a setup yet" : `No setups match “${search.trim()}”`
          }
          description={emptyHint}
        />
      ) : (
        <ul className={CARD_GRID}>
          {shown.map((setup) => (
            <li key={setup.owner.id}>
              <SetupCard setup={setup} />
            </li>
          ))}
        </ul>
      )}
      {setups.isFetchNextPageError && (
        <Banner
          role="alert"
          status="error"
          title="More setups couldn't be loaded"
          description={errorMessage(setups.error)}
        />
      )}
      {setups.hasNextPage && (
        <HStack hAlign="center">
          <Button
            label="Load more"
            isLoading={setups.isFetchingNextPage}
            onClick={() => {
              void setups.fetchNextPage();
            }}
          />
        </HStack>
      )}
    </VStack>
  );
}

/** The Agent setups tab. The dialog sits outside the list, so it stays open while it loads. */
function Setups({ search }: { search: string }) {
  const [isSharing, setIsSharing] = useState(false);
  return (
    <VStack gap={4}>
      <HStack gap={3} vAlign="center" hAlign="between" wrap="wrap">
        <Text type="supporting">
          The skills, MCP servers and plugins other developers use in Claude Code and Codex.
        </Text>
        <Button
          variant="primary"
          label="Share your setup"
          icon={<Icon icon={Bot} />}
          onClick={() => {
            setIsSharing(true);
          }}
        />
      </HStack>
      <SetupList search={search} />
      {isSharing && (
        <ShareSetupDialog
          onClose={() => {
            setIsSharing(false);
          }}
        />
      )}
    </VStack>
  );
}

/** Community: collections other developers published, searchable, newest first. Signed out, it
 * shows only the way to sign in, and fetches nothing. */
export function CommunityPage() {
  return (
    <CommunitySignInGate>
      <CommunityContent />
    </CommunitySignInGate>
  );
}

function CommunityContent() {
  const [search, setSearch] = useState("");
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab");
  const view: View = tab === "mine" || tab === "setups" ? tab : "everyone";
  const setView = (next: View) => {
    setParams(next === "everyone" ? {} : { tab: next }, { replace: true });
  };

  return (
    <VStack gap={5} padding={6}>
      {/* The account and Sign out live in the sidebar, under Settings. */}
      <PageHeader
        title="Community"
        description="Collections and agent setups other developers shared. Add any of their links to your library."
      />

      <HStack gap={4} vAlign="center" hAlign="between" wrap="wrap">
        <TabList
          aria-label="Show"
          value={view}
          onChange={(value) => {
            setView(value === "mine" || value === "setups" ? value : "everyone");
          }}
        >
          <Tab value="everyone" label="Everyone" icon={<Icon icon={Users} />} />
          <Tab value="setups" label="Agent setups" icon={<Icon icon={Bot} />} />
          <Tab value="mine" label="Shared by you" icon={<Icon icon={Share2} />} />
        </TabList>
        <SearchField
          value={search}
          onChange={setSearch}
          label={view === "setups" ? "Search shared setups" : "Search Community collections"}
          placeholder={view === "setups" ? "Search setups…" : "Search collections…"}
        />
      </HStack>

      {view === "mine" && <Mine search={search} />}
      {view === "setups" && <Setups search={search} />}
      {view === "everyone" && <Everyone search={search} />}
    </VStack>
  );
}
