import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { List, ListItem } from "@astryxdesign/core/List";
import { Selector } from "@astryxdesign/core/Selector";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Text } from "@astryxdesign/core/Text";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import { VStack } from "@astryxdesign/core/VStack";
import { Code, Database, Layers, Rss, Search, SquareCode, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";

import { FilterTabs } from "@/components/shared/filter-tabs";
import {
  newsCategories,
  type NewsCategory,
  type NewsItem,
  type NewsSource,
} from "@/types/news.types";

import { useNews } from "../hooks/use-news";
import { sourceIcon } from "../news-icons";
import { FeedError } from "./feed-error";
import { BrandIcon, TopStories } from "./news-top";
import { WebLink } from "./web-link";

const CATEGORIES: Record<NewsCategory, { label: string; icon: LucideIcon }> = {
  language: { label: "Languages", icon: Code },
  framework: { label: "Frameworks", icon: Layers },
  database: { label: "Databases", icon: Database },
  tool: { label: "Tools & platforms", icon: Wrench },
};
const POSTS_PER_SOURCE = 3;
const ALL_SOURCES = "all";

function SourceLogo({ source, className }: { source: NewsSource; className?: string }) {
  return (
    <BrandIcon
      icon={sourceIcon(source.id)}
      label={source.name}
      className={className}
      fallback={source.id === "vscode" ? <Icon icon={SquareCode} /> : undefined}
    />
  );
}

/** What developers are discussing on top, then the latest posts from official blogs, by
 * category. */
export function NewsView({
  search,
  matches,
}: {
  search: string;
  /** Narrows the page to what matches the user's interests. */
  matches?: (text: string) => boolean;
}) {
  return (
    <div className="mt-5">
      <VStack gap={10}>
        <TopStories matches={matches} />
        <LatestPosts search={search} matches={matches} />
      </VStack>
    </div>
  );
}

function LatestPosts({ search, matches }: { search: string; matches?: (text: string) => boolean }) {
  const news = useNews();
  const [category, setCategory] = useState<NewsCategory | "all">("all");
  const [sourceId, setSourceId] = useState(ALL_SOURCES);

  if (news.isPending) {
    return (
      <Grid columns={{ minWidth: 300, max: 3 }} gap={6} role="status" aria-busy="true">
        <VisuallyHidden>Loading the latest posts</VisuallyHidden>
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} height={176} index={index} />
        ))}
      </Grid>
    );
  }
  if (news.isError) return <FeedError title="Latest posts unavailable" query={news} />;

  const { sources, items, unavailable } = news.data;
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const term = search.trim().toLowerCase();
  const visible = items.filter((item) => {
    const source = sourceById.get(item.sourceId);
    if (source === undefined) return false;
    if (category !== "all" && source.category !== category) return false;
    if (sourceId !== ALL_SOURCES && item.sourceId !== sourceId) return false;
    if (matches !== undefined && !matches(`${source.name} ${item.title} ${item.summary ?? ""}`)) {
      return false;
    }
    if (term === "") return true;
    return [item.title, item.summary ?? "", source.name].some((text) =>
      text.toLowerCase().includes(term),
    );
  });
  const flat = term !== "" || sourceId !== ALL_SOURCES;
  const unavailableNames = unavailable.flatMap((id) => sourceById.get(id)?.name ?? []);
  const shownCategories = newsCategories.filter(
    (value) => category === "all" || value === category,
  );

  return (
    <section aria-labelledby="latest-posts-heading">
      <VStack gap={4}>
        <HStack gap={2} vAlign="center">
          <Icon icon={Rss} color="accent" />
          <Heading level={2} id="latest-posts-heading">
            Latest from official blogs
          </Heading>
        </HStack>
        <HStack gap={3} vAlign="center" hAlign="between" wrap="wrap">
          <FilterTabs
            label="Category"
            value={category}
            onChange={(value) => {
              setCategory(value);
              setSourceId(ALL_SOURCES);
            }}
            options={(["all", ...newsCategories] as const).map((value) => ({
              value,
              label: value === "all" ? "All" : CATEGORIES[value].label,
              count:
                value === "all"
                  ? items.length
                  : items.filter((item) => sourceById.get(item.sourceId)?.category === value)
                      .length,
              icon: value === "all" ? undefined : <Icon icon={CATEGORIES[value].icon} />,
            }))}
          />
          <Selector
            label="Source"
            isLabelHidden
            value={sourceId}
            onChange={setSourceId}
            options={[
              { value: ALL_SOURCES, label: "All sources" },
              ...shownCategories.map((value) => ({
                type: "section" as const,
                title: CATEGORIES[value].label,
                options: sources
                  .filter((source) => source.category === value)
                  .map((source) => ({ value: source.id, label: source.name })),
              })),
            ]}
          />
        </HStack>

        {visible.length === 0 ? (
          <EmptyState
            isCompact
            icon={<Icon icon={Search} />}
            title="No posts match these filters."
            description="Try another category or source, or clear your search."
          />
        ) : flat ? (
          <List aria-label="Matching posts" hasDividers>
            {visible.flatMap((item) => {
              const source = sourceById.get(item.sourceId);
              return source === undefined
                ? []
                : [<PostRow key={item.url} item={item} source={source} />];
            })}
          </List>
        ) : (
          <VStack gap={8}>
            {shownCategories.map((value) => (
              <CategorySection
                key={value}
                category={value}
                sources={sources.filter((source) => source.category === value)}
                items={visible}
                onShowSource={setSourceId}
              />
            ))}
          </VStack>
        )}

        {unavailableNames.length > 0 && (
          <Text type="supporting" as="p">
            Couldn&apos;t be read right now: {unavailableNames.join(", ")}.
          </Text>
        )}
      </VStack>
    </section>
  );
}

function CategorySection({
  category,
  sources,
  items,
  onShowSource,
}: {
  category: NewsCategory;
  sources: NewsSource[];
  items: NewsItem[];
  onShowSource: (sourceId: string) => void;
}) {
  const { label, icon } = CATEGORIES[category];
  // Sources with the most recent post first; items are already newest first.
  const withPosts = sources
    .map((source) => ({ source, posts: items.filter((item) => item.sourceId === source.id) }))
    .filter(({ posts }) => posts.length > 0)
    .sort((a, b) => (b.posts[0]?.publishedAt ?? 0) - (a.posts[0]?.publishedAt ?? 0));
  if (withPosts.length === 0) return null;

  return (
    <VStack as="section" aria-labelledby={`news-${category}`} gap={4}>
      <HStack gap={2} vAlign="center">
        <Icon icon={icon} color="secondary" />
        <Heading level={3} id={`news-${category}`}>
          {label}
        </Heading>
        <Text type="supporting" hasTabularNumbers>
          {withPosts.length} sources
        </Text>
      </HStack>
      <Grid columns={{ minWidth: 300, max: 3 }} gap={4}>
        {withPosts.map(({ source, posts }) => (
          <Card key={source.id} padding={4} height="100%">
            <VStack as="article" gap={2}>
              <HStack gap={3} vAlign="center">
                <SourceLogo source={source} className="size-9" />
                <div className="min-w-0 flex-1">
                  <Heading level={4} maxLines={1}>
                    {source.name}
                  </Heading>
                </div>
                <Button
                  label={`All posts from ${source.name}`}
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onShowSource(source.id);
                  }}
                >
                  All posts
                </Button>
              </HStack>
              <List hasDividers edge="flush" density="compact">
                {posts.slice(0, POSTS_PER_SOURCE).map((item) => (
                  <ListItem
                    key={item.url}
                    label={
                      <Text as="p" maxLines={2}>
                        <WebLink href={item.url}>{item.title}</WebLink>
                      </Text>
                    }
                    description={
                      item.publishedAt === null ? undefined : (
                        <Timestamp value={item.publishedAt} format="relative" hasTooltip={false} />
                      )
                    }
                  />
                ))}
              </List>
            </VStack>
          </Card>
        ))}
      </Grid>
    </VStack>
  );
}

function PostRow({ item, source }: { item: NewsItem; source: NewsSource }) {
  return (
    <ListItem
      align="start"
      startContent={<SourceLogo source={source} className="size-9" />}
      label={
        <VStack gap={0.5}>
          <HStack gap={1} vAlign="center">
            <Text type="supporting">{source.name}</Text>
            {item.publishedAt !== null && (
              <>
                <Text type="supporting">·</Text>
                <Timestamp value={item.publishedAt} format="relative" hasTooltip={false} />
              </>
            )}
          </HStack>
          <Heading level={4} accessibilityLevel={3}>
            <WebLink href={item.url}>{item.title}</WebLink>
          </Heading>
        </VStack>
      }
      description={
        item.summary === null ? undefined : (
          <Text as="p" color="secondary" maxLines={2}>
            {item.summary}
          </Text>
        )
      }
    />
  );
}
