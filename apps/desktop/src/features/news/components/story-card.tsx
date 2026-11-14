import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { List, ListItem } from "@astryxdesign/core/List";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Text } from "@astryxdesign/core/Text";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import { VStack } from "@astryxdesign/core/VStack";
import { MessageSquare, Triangle } from "lucide-react";
import { useRef } from "react";

import { RemoteImage, SiteIcon } from "@/features/library";
import { useResourcePreview } from "@/hooks/use-resource-preview";
import type { TopStory } from "@/types/news.types";

import { siteHost } from "../news-links";
import { WebLink } from "./web-link";

/**
 * Two columns once the enclosing `@container` is wide enough, one otherwise. Dividers sit under
 * every row but the last; in two columns the last row's left story drops its line too.
 */
const STORY_LIST =
  "grid @3xl:grid-cols-2 @3xl:gap-x-8! @3xl:[&>li:nth-last-child(2):nth-child(odd)]:border-b-0!";

/** A page's preview image (or its icon), from the same on-disk cache as library cards. */
function PreviewImage({ url }: { url: string }) {
  const preview = useResourcePreview(url);
  if (preview.isPending) return <Skeleton radius="none" />;
  return (
    <RemoteImage
      src={preview.data?.image ?? null}
      className="size-full object-cover"
      fallback={
        <div className="flex size-full items-center justify-center">
          <SiteIcon
            icon={preview.data?.icon ?? null}
            host={siteHost(url)}
            className="size-10 rounded-xl text-base"
          />
        </div>
      }
    />
  );
}

/** Top stories as compact rows, shared by the dashboard and the News page. */
export function StoryList({ stories }: { stories: readonly TopStory[] }) {
  return (
    <List aria-label="Top stories" hasDividers className={STORY_LIST}>
      {stories.map((story) => (
        <StoryRow key={story.discussionUrl} story={story} />
      ))}
    </List>
  );
}

export function StoryListSkeleton({ rows }: { rows: number }) {
  return (
    <div role="status" aria-busy="true" className={`${STORY_LIST} gap-2`}>
      <VisuallyHidden>Loading top stories</VisuallyHidden>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} height={76} index={index} />
      ))}
    </div>
  );
}

/** One story, opening inside DevAtlas. Clicking the row follows the title's link. */
function StoryRow({ story }: { story: TopStory }) {
  const titleLink = useRef<HTMLAnchorElement>(null);
  return (
    <ListItem
      interactiveRef={titleLink}
      startContent={
        <div
          aria-hidden
          className="h-14 w-24 shrink-0 overflow-hidden rounded-md"
          style={{ backgroundColor: "var(--color-background-muted)" }}
        >
          <PreviewImage url={story.url} />
        </div>
      }
      label={
        <Heading level={5} accessibilityLevel={3} maxLines={2}>
          <WebLink ref={titleLink} href={story.url} title={story.title}>
            {story.title}
          </WebLink>
        </Heading>
      }
      description={
        <VStack gap={0.5}>
          <Text type="supporting" maxLines={1}>
            {siteHost(story.url)}
          </Text>
          <HStack gap={3} vAlign="center" wrap="wrap">
            <HStack as="span" gap={1} vAlign="center">
              <Icon icon={Triangle} size="xsm" color="accent" />
              <Text type="supporting" hasTabularNumbers>
                {story.points}
              </Text>
              <VisuallyHidden> points</VisuallyHidden>
            </HStack>
            <Text type="supporting" hasTabularNumbers>
              <WebLink href={story.discussionUrl}>
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  <Icon icon={MessageSquare} size="xsm" /> {story.comments} comments
                </span>
              </WebLink>
            </Text>
            <Timestamp value={story.publishedAt} format="relative" hasTooltip={false} />
          </HStack>
        </VStack>
      }
    />
  );
}
