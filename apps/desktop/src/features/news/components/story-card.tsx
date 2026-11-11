import { formatDistanceToNowStrict } from "date-fns";
import { MessageSquare, Triangle } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { RemoteImage, SiteIcon } from "@/features/library";
import { useResourcePreview } from "@/hooks/use-resource-preview";
import type { TopStory } from "@/types/news.types";

import { siteHost } from "../news-links";
import { WebLink } from "./web-link";

/** Two columns once the enclosing `@container` is wide enough, one otherwise. */
const STORY_LIST = "grid gap-1 rounded-xl border border-border bg-card p-1.5 @3xl:grid-cols-2";

/** A page's preview image (or its icon), from the same on-disk cache as library cards. */
function PreviewImage({ url }: { url: string }) {
  const preview = useResourcePreview(url);
  if (preview.isPending) {
    return <Skeleton className="size-full rounded-none bg-foreground/[0.04]" />;
  }
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
    <ol aria-label="Top stories" className={STORY_LIST}>
      {stories.map((story) => (
        <li key={story.discussionUrl}>
          <StoryRow story={story} />
        </li>
      ))}
    </ol>
  );
}

export function StoryListSkeleton({ rows }: { rows: number }) {
  return (
    <div role="status" aria-busy="true" className={STORY_LIST}>
      <span className="sr-only">Loading top stories</span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-[76px] rounded-lg" />
      ))}
    </div>
  );
}

/** One story, opening inside DevAtlas. The title's link covers the row. */
function StoryRow({ story }: { story: TopStory }) {
  return (
    <article className="relative flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-secondary">
      <div
        aria-hidden
        className="h-14 w-24 shrink-0 overflow-hidden rounded-md border border-border bg-secondary"
      >
        <PreviewImage url={story.url} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium text-foreground">
          <WebLink
            href={story.url}
            title={story.title}
            className="after:absolute after:inset-0 after:rounded-lg focus-visible:ring-0 focus-visible:after:ring-2 focus-visible:after:ring-ring"
          >
            {story.title}
          </WebLink>
        </h3>
        <p className="truncate font-mono text-xs text-muted-foreground">{siteHost(story.url)}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
          <span className="inline-flex items-center gap-1">
            <Triangle className="size-2.5 fill-current text-primary" aria-hidden />
            {story.points}
            <span className="sr-only">{" points"}</span>
          </span>
          <WebLink
            href={story.discussionUrl}
            className="relative z-10 inline-flex items-center gap-1"
          >
            <MessageSquare className="size-3" aria-hidden />
            {story.comments} comments
          </WebLink>
          <span>{formatDistanceToNowStrict(story.publishedAt, { addSuffix: true })}</span>
        </p>
      </div>
    </article>
  );
}
