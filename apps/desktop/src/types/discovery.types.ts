import { z } from "zod";

export const trendingPeriods = ["day", "week", "month"] as const;
export type TrendingPeriod = (typeof trendingPeriods)[number];

export const starBoardViews = ["weekly", "alltime", "random", "pyramid"] as const;
export type StarBoardView = (typeof starBoardViews)[number];

/** IPC contract for `list_trending_repos` and `get_github_repo`; mirrors
 * `devatlas_application::discovery::GithubRepo`. */
export const githubRepoSchema = z.object({
  fullName: z.string().min(1),
  url: z.url().startsWith("https://github.com/"),
  description: z.string().nullable(),
  language: z.string().nullable(),
  stars: z.number().int().nonnegative(),
  forks: z.number().int().nonnegative(),
  ownerAvatar: z.url().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});
export type GithubRepo = z.infer<typeof githubRepoSchema>;

export const githubReposSchema = z.array(githubRepoSchema);

const starRepoSchema = z.object({
  fullName: z.string().regex(/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/),
  stars: z.number().int().nonnegative(),
  newStars: z.number().int().nonnegative().nullable(),
  rankChange: z.number().int().nullable(),
});
export type StarRepo = z.infer<typeof starRepoSchema>;

/** IPC contract for `get_star_boards`; mirrors
 * `devatlas_application::star_history::StarBoards`. */
export const starBoardsSchema = z.object({
  weekly: z.array(starRepoSchema),
  weeklyPeriod: z.string().nullable(),
  allTime: z.array(starRepoSchema),
  allTimeUpdated: z.string().nullable(),
  randomPool: z.array(starRepoSchema),
  pyramid: z.array(
    z.object({
      threshold: z.number().int().nonnegative(),
      label: z.string().min(1),
      count: z.number().int().nonnegative(),
    }),
  ),
  pyramidUpdated: z.string().nullable(),
});
export type StarBoards = z.infer<typeof starBoardsSchema>;
