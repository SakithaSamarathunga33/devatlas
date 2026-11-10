import { Skeleton } from "@/components/ui/skeleton";

import { useTopStories } from "../hooks/use-news";
import { StoryCard } from "./story-card";

/** Four across once the column is wide enough, two by two otherwise. */
const SHOWN = 4;
const GRID = "grid grid-cols-2 gap-3 @2xl:grid-cols-4";

/** The top Hacker News stories as preview cards, for the dashboard. Shares its cache with the
 * News page. */
export function NewsPreview() {
  const stories = useTopStories();

  if (stories.isPending) {
    return (
      <div role="status" aria-busy="true" className={GRID}>
        <span className="sr-only">Loading top stories</span>
        {Array.from({ length: SHOWN }, (_, index) => (
          <Skeleton key={index} className="h-60 rounded-xl" />
        ))}
      </div>
    );
  }
  if (stories.isError) {
    return <p>{stories.error.message.replace(/^.*?failed: /, "")}</p>;
  }
  if (stories.data.length === 0) {
    return <p>No stories right now.</p>;
  }

  return (
    <ol aria-label="Top stories" className={GRID}>
      {stories.data.slice(0, SHOWN).map((story) => (
        <li key={story.discussionUrl}>
          <StoryCard story={story} />
        </li>
      ))}
    </ol>
  );
}
