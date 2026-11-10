import { formatDistanceToNowStrict } from "date-fns";
import { MessageSquare, Triangle } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { RemoteImage, SiteIcon } from "@/features/library";
import { useResourcePreview } from "@/hooks/use-resource-preview";
import type { TopStory } from "@/types/news.types";

import { siteHost } from "../news-links";
import { WebLink } from "./web-link";

/** A page's preview image (or its icon), from the same on-disk cache as library cards. */
export function PreviewImage({ url, className }: { url: string; className?: string }) {
  const preview = useResourcePreview(url);
  if (preview.isPending) {
    return <Skeleton className="size-full rounded-none bg-foreground/[0.04]" />;
  }
  return (
    <RemoteImage
      src={preview.data?.image ?? null}
      className={className ?? "size-full object-cover"}
      fallback={
        <div className="flex size-full items-center justify-center">
          <SiteIcon
            icon={preview.data?.icon ?? null}
            host={siteHost(url)}
            className="size-12 rounded-2xl text-lg"
          />
        </div>
      }
    />
  );
}

/** A top story with its page's preview image; opens inside DevAtlas. */
export function StoryCard({ story }: { story: TopStory }) {
  const site = siteHost(story.url);

  return (
    <article className="group/card flex h-full flex-col rounded-xl border border-border bg-card transition-[border-color,box-shadow] duration-150 hover:border-foreground/15 hover:shadow-[0_10px_24px_-14px_rgb(0_0_0/0.7)]">
      <WebLink
        href={story.url}
        className="flex flex-1 flex-col rounded-t-[inherit] hover:no-underline"
      >
        <div className="relative aspect-[1200/630] overflow-hidden rounded-t-[inherit] border-b border-border bg-linear-to-br from-primary/25 to-secondary">
          <PreviewImage
            url={story.url}
            className="size-full object-cover transition-transform duration-500 group-hover/card:scale-[1.03] motion-reduce:transition-none"
          />
        </div>
        <div className="px-4 pt-4">
          <h3 className="line-clamp-2 text-sm leading-snug font-medium text-foreground group-hover/card:underline group-hover/card:underline-offset-4">
            {story.title}
          </h3>
          <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{site}</p>
        </div>
      </WebLink>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-2 pb-4 text-xs text-muted-foreground tabular-nums">
        <span className="inline-flex items-center gap-1">
          <Triangle className="size-2.5 fill-current text-primary" aria-hidden />
          {story.points}
          <span className="sr-only">{" points"}</span>
        </span>
        <WebLink href={story.discussionUrl} className="inline-flex items-center gap-1">
          <MessageSquare className="size-3" aria-hidden />
          {story.comments} comments
        </WebLink>
        <span>{formatDistanceToNowStrict(story.publishedAt, { addSuffix: true })}</span>
      </p>
    </article>
  );
}
