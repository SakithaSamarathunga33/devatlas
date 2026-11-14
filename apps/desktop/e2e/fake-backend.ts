/**
 * The scripted Rust backend the E2E suite runs the real UI against. Every `invoke()` from the
 * page lands in `FakeBackend.handle`, which answers with the shapes the Tauri commands return,
 * checks the structured ones against the app's own Zod contracts, and records every call.
 * Command names and payloads mirror src/services/*.service.ts; keep them in sync.
 */
import type { z } from "zod";

import { appInfoSchema, updateSchema } from "../src/types/app-info.types";
import {
  communityUserSchema,
  followStateSchema,
  sharedCollectionSchema,
  sharedPageSchema,
  sharePreviewSchema,
  type CommunityUser,
  type SharedCollection,
  type SharePreview,
} from "../src/types/community.types";
import type { RepoRelease } from "../src/types/discovery.types";
import {
  librarySnapshotSchema,
  savedResourceSchema,
  type Resource,
} from "../src/types/library.types";
import { groupsSchema, type Group } from "../src/types/organizer.types";
import { settingsViewSchema } from "../src/types/settings.types";

export interface Scenario {
  /** Whether the first-launch welcome was answered (`get_onboarded`). */
  onboarded: boolean;
  /** The stored Community session at launch. */
  user: CommunityUser | null;
  /** Who `community_sign_in` signs in. */
  signInUser: CommunityUser;
  /** The newer release `check_for_update` reports, or `null` when up to date. */
  update: RepoRelease | null;
  library: Resource[];
  groups: Group[];
  /** Collections published to Community by other accounts. */
  shared: SharedCollection[];
}

export interface Call {
  command: string;
  args: Record<string, unknown>;
}

type Args = Record<string, unknown>;

export const OCTOCAT: CommunityUser = {
  id: "user-1",
  username: "octocat",
  avatarUrl: "https://avatars.githubusercontent.com/u/1",
};

export function resource(id: string, url: string, title: string): Resource {
  const host = new URL(url).host;
  return {
    id,
    title,
    url,
    host,
    category: "tools",
    folder: "",
    addedAt: 1_700_000_000_000,
    origin: "devatlas",
    isNew: false,
    categoryOverride: null,
    status: null,
    tags: [],
    note: null,
    lastOpenedAt: null,
    linkHealth: null,
  };
}

export const SHARED_COLLECTION: SharedCollection = {
  id: "c0ffee00-0000-4000-8000-000000000001",
  title: "Rust desktop starter",
  description: "What I reach for when starting a Tauri app.",
  linkCount: 2,
  updatedAt: "2026-11-01T10:00:00Z",
  owner: { id: "user-2", username: "ferris", avatarUrl: null },
  followerCount: 3,
  isFollowing: false,
  links: [
    {
      url: "https://tauri.app/start/",
      title: "Tauri: Get started",
      host: "tauri.app",
      libraryId: "tauri.app/start",
    },
    {
      url: "https://docs.rs/serde/latest/serde/",
      title: "serde docs",
      host: "docs.rs",
      libraryId: "docs.rs/serde/latest/serde",
    },
  ],
};

export const NEWER_RELEASE: RepoRelease = {
  tag: "v0.2.0-build.42",
  name: "DevAtlas 0.2.0",
  url: "https://github.com/devatlas/devatlas/releases/tag/v0.2.0-build.42",
  publishedAt: "2026-11-10T09:00:00Z",
};

export function defaultScenario(): Scenario {
  return {
    onboarded: true,
    user: null,
    signInUser: OCTOCAT,
    update: null,
    library: [],
    groups: [],
    shared: [SHARED_COLLECTION],
  };
}

/** Commands the UI calls only on a user's action never resolve here unless scripted. */
const NEVER: Promise<never> = new Promise(() => undefined);

/** `devatlas_application::agent::without_secrets`: no query, fragment or credentials. */
function withoutSecrets(raw: string): string {
  const url = new URL(raw);
  url.search = "";
  url.hash = "";
  url.username = "";
  url.password = "";
  return url.href;
}

/** `devatlas_application::community::share_preview`. */
function sharePreview(group: Group, library: readonly Resource[]): SharePreview {
  const members = library.filter((item) => group.resourceIds.includes(item.id));
  const https = members.filter((item) => new URL(item.url).protocol === "https:");
  return {
    title: group.name,
    description: group.description,
    links: https.map((item) => {
      const url = withoutSecrets(item.url);
      return { url, title: item.title, host: new URL(url).host };
    }),
    skipped: members.length - https.length,
    sharedId: null,
  };
}

/** The answer as the app's own schema reads it (extra fields dropped), or a loud failure. */
function validated<T>(schema: z.ZodType<T>, command: string, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(`Fake backend: "${command}" breaks its IPC contract: ${result.error.message}`);
  }
  return result.data;
}

export class FakeBackend {
  readonly calls: Call[] = [];
  /** Commands the UI called that this backend doesn't know; the fixture fails the test on any. */
  readonly unmocked: string[] = [];
  private readonly state: Scenario;

  constructor(scenario: Scenario) {
    this.state = scenario;
  }

  callsTo(command: string): Call[] {
    return this.calls.filter((call) => call.command === command);
  }

  handle(command: string, args: Args): unknown {
    this.calls.push({ command, args });
    return this.respond(command, args);
  }

  private collection(args: Args): SharedCollection {
    const found = this.state.shared.find((item) => item.id === args.id);
    if (found === undefined) throw new Error("This collection no longer exists.");
    return found;
  }

  private follow(args: Args, following: boolean) {
    const current = this.collection(args);
    const followerCount = current.followerCount + (following ? 1 : -1);
    this.state.shared = this.state.shared.map((item) =>
      item.id === current.id ? { ...item, isFollowing: following, followerCount } : item,
    );
    return validated(followStateSchema, "follow_shared_collection", { following, followerCount });
  }

  private addLink(args: Args) {
    if (typeof args.url !== "string") throw new Error("add_link needs a `url`.");
    const url = args.url;
    const saved = resource(url.replace(/^https?:\/\//, "").replace(/\/$/, ""), url, url);
    this.state.library = [...this.state.library, saved];
    return validated(savedResourceSchema, "add_link", saved);
  }

  // One switch mirroring the command table; most branches are a single canned answer.
  private respond(command: string, args: Args): unknown {
    switch (command) {
      // App shell
      case "get_app_info":
        return validated(appInfoSchema, command, {
          name: "DevAtlas",
          version: "0.1.0",
          platform: "windows",
        });
      case "check_for_update":
        return validated(updateSchema, command, this.state.update);
      case "install_update":
        // On success the real app restarts before answering.
        return NEVER;
      case "get_onboarded":
        return this.state.onboarded;
      case "complete_onboarding":
        this.state.onboarded = true;
        return null;

      // Community
      case "community_session":
        return validated(communityUserSchema.nullable(), command, this.state.user);
      case "community_sign_in":
        this.state.user = this.state.signInUser;
        return validated(communityUserSchema, command, this.state.user);
      case "community_cancel_sign_in":
        return null;
      case "community_sign_out":
      case "delete_community_account":
        this.state.user = null;
        return null;
      case "list_shared_collections":
        // Summaries: the schema drops each collection's links and follow state.
        return validated(sharedPageSchema, command, {
          collections: this.state.shared,
          nextOffset: null,
        });
      case "my_shared_collections":
        return [];
      case "get_shared_collection":
        return validated(sharedCollectionSchema, command, this.collection(args));
      case "follow_shared_collection":
        return this.follow(args, true);
      case "unfollow_shared_collection":
        return this.follow(args, false);
      case "preview_group_share": {
        const group = this.state.groups.find((item) => item.id === args.groupId);
        if (group === undefined) throw new Error("This collection no longer exists.");
        return validated(sharePreviewSchema, command, sharePreview(group, this.state.library));
      }
      case "share_group":
        return "c0ffee00-0000-4000-8000-0000000000aa";

      // Library and collections
      case "list_library":
        return validated(librarySnapshotSchema, command, {
          source: { browser: "", folder: "", warning: null },
          resources: this.state.library,
        });
      case "add_link":
        return this.addLink(args);
      case "get_resource_preview":
        return { image: null, icon: null };
      case "mark_resource_opened":
        return null;
      case "list_groups":
        return validated(groupsSchema, command, this.state.groups);
      case "list_snippets":
      case "list_removed_suggestions":
        return [];
      case "sync_github_stars":
        return 0;

      // Discover (empty feeds: nothing here is under test)
      case "list_top_stories":
      case "list_trending_repos":
      case "list_language_rankings":
        return [];
      case "list_news":
        return { sources: [], items: [], unavailable: [] };

      // Settings
      case "get_settings":
        return validated(settingsViewSchema, command, {
          hasGithubToken: false,
          settings: { browser: null, profile: "Default", folder: "" },
          options: [],
        });
      case "get_agent_connection":
        return {
          executable: "C:\\Program Files\\DevAtlas\\devatlas-desktop.exe",
          usage: { lookups: 0, lastAt: null },
        };
      case "get_star_sync":
        return null;

      default:
        this.unmocked.push(command);
        throw new Error(`The fake backend has no answer for "${command}".`);
    }
  }
}
