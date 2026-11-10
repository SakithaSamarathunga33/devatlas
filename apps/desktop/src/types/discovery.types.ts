import { z } from "zod";

export const trendingPeriods = ["day", "week", "month"] as const;
export type TrendingPeriod = (typeof trendingPeriods)[number];

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
