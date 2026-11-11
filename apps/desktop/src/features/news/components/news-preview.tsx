import { useTopStories } from "../hooks/use-news";
import { StoryList, StoryListSkeleton } from "./story-card";

const SHOWN = 4;

/** The top Hacker News stories, for the dashboard. Shares its cache with the News page. */
export function NewsPreview() {
  const stories = useTopStories();

  if (stories.isPending) return <StoryListSkeleton rows={SHOWN} />;
  if (stories.isError) {
    return <p>{stories.error.message.replace(/^.*?failed: /, "")}</p>;
  }
  if (stories.data.length === 0) {
    return <p>No stories right now.</p>;
  }

  return <StoryList stories={stories.data.slice(0, SHOWN)} />;
}
