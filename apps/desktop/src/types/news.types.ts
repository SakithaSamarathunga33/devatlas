import { z } from "zod";

/** Only web links reach the UI; everything else from feeds is rejected here too. */
const webUrl = z.url({ protocol: /^https?$/ });

export const newsCategories = ["language", "framework", "database", "tool"] as const;
export type NewsCategory = (typeof newsCategories)[number];

/** IPC contract for `list_news`; mirrors `devatlas_application::news::NewsFeed`. */
export const newsFeedSchema = z.object({
  sources: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      category: z.enum(newsCategories),
    }),
  ),
  items: z.array(
    z.object({
      sourceId: z.string().min(1),
      title: z.string().min(1),
      url: webUrl,
      publishedAt: z.number().int().nullable(),
      summary: z.string().nullable(),
    }),
  ),
  unavailable: z.array(z.string()),
});
export type NewsFeed = z.infer<typeof newsFeedSchema>;
export type NewsSource = NewsFeed["sources"][number];
export type NewsItem = NewsFeed["items"][number];

/** IPC contract for `list_top_stories`; mirrors `devatlas_application::news::TopStory`. */
export const topStoriesSchema = z.array(
  z.object({
    title: z.string().min(1),
    url: webUrl,
    discussionUrl: webUrl,
    points: z.number().int().nonnegative(),
    comments: z.number().int().nonnegative(),
    publishedAt: z.number().int(),
  }),
);
export type TopStory = z.infer<typeof topStoriesSchema>[number];

/** IPC contract for `list_language_rankings`; mirrors
 * `devatlas_application::rankings::LanguageRanking`. */
export const languageRankingsSchema = z.array(
  z.object({
    index: z.enum(["tiobe", "pypl"]),
    period: z.string().min(1),
    sourceUrl: webUrl,
    languages: z.array(
      z.object({
        rank: z.number().int().positive(),
        previousRank: z.number().int().positive().nullable(),
        language: z.string().min(1),
        share: z.number().min(0).max(100),
        change: z.number().nullable(),
      }),
    ),
  }),
);
export type LanguageRanking = z.infer<typeof languageRankingsSchema>[number];
