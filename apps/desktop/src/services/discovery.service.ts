import { invokeCommand } from "@/services/ipc";
import {
  githubRepoSchema,
  githubReposSchema,
  starBoardsSchema,
  type GithubRepo,
  type StarBoards,
  type TrendingPeriod,
} from "@/types/discovery.types";

/** Language, stars and description of one repository (`owner/name`), fetched in Rust. */
export function getGithubRepo(fullName: string): Promise<GithubRepo> {
  return invokeCommand("get_github_repo", githubRepoSchema, { fullName });
}

/** Repositories created within `period` with the most stars on GitHub (fetched in Rust). */
export function listTrendingRepos(
  period: TrendingPeriod,
  language: string | null,
): Promise<GithubRepo[]> {
  return invokeCommand("list_trending_repos", githubReposSchema, { period, language });
}

/** star-history.com's repository rankings (read in Rust). */
export function getStarBoards(): Promise<StarBoards> {
  return invokeCommand("get_star_boards", starBoardsSchema);
}
