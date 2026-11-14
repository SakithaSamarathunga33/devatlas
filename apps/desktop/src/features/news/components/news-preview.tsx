import { Banner } from "@astryxdesign/core/Banner";
import { EmptyState } from "@astryxdesign/core/EmptyState";

import { useTopStories } from "../hooks/use-news";
import { StoryList, StoryListSkeleton } from "./story-card";

/** Three rows once the dashboard's wide enough for two columns. */
const SHOWN = 6;

/** The top Hacker News stories, for the dashboard. Shares its cache with the News page. */
export function NewsPreview() {
  const stories = useTopStories();

  if (stories.isPending) return <StoryListSkeleton rows={SHOWN} />;
  if (stories.isError) {
    return (
      <Banner
        status="error"
        title="Top stories aren't available"
        description={stories.error.message.replace(/^.*?failed: /, "")}
      />
    );
  }
  if (stories.data.length === 0) {
    return <EmptyState isCompact title="No stories right now." />;
  }

  return <StoryList stories={stories.data.slice(0, SHOWN)} />;
}
