import { invokeCommand } from "@/services/ipc";
import {
  languageRankingsSchema,
  newsFeedSchema,
  topStoriesSchema,
  type LanguageRanking,
  type NewsFeed,
  type TopStory,
} from "@/types/news.types";

/** Latest posts from the official blogs DevAtlas follows (read in Rust). */
export function listNews(): Promise<NewsFeed> {
  return invokeCommand("list_news", newsFeedSchema);
}

/** Stories developers are discussing now (Hacker News front page). */
export function listTopStories(): Promise<TopStory[]> {
  return invokeCommand("list_top_stories", topStoriesSchema);
}

/** Monthly language-popularity indexes (TIOBE, PYPL). */
export function listLanguageRankings(): Promise<LanguageRanking[]> {
  return invokeCommand("list_language_rankings", languageRankingsSchema);
}
