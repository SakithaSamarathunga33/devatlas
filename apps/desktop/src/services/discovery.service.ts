import { invokeCommand } from "@/services/ipc";
import {
  githubRepoSchema,
  githubReposSchema,
  repoActivitySchema,
  starBoardsSchema,
  type GithubRepo,
  type RepoActivity,
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

/** A saved repository's newest release and recent star growth. */
export function getRepoActivity(fullName: string): Promise<RepoActivity> {
  return invokeCommand("get_repo_activity", repoActivitySchema, { fullName });
}

/** star-history.com's repository rankings (read in Rust). */
export function getStarBoards(): Promise<StarBoards> {
  return invokeCommand("get_star_boards", starBoardsSchema);
}
