import type {
  CommunityUser,
  SharedCollection,
  SharedSummary,
  SharePreview,
} from "@/types/community.types";
import type { LibrarySnapshot } from "@/types/library.types";

export const OWNER_ID = "11111111-2222-4333-8444-555555555555";
export const COLLECTION_ID = "0b8f4a9e-6d2c-4b1a-9f3e-2c7d5e8a1b40";

export const USER: CommunityUser = {
  id: "99999999-2222-4333-8444-555555555555",
  username: "me",
  avatarUrl: null,
};

export function summary(overrides: Partial<SharedSummary> = {}): SharedSummary {
  return {
    id: COLLECTION_ID,
    title: "Rust tools",
    description: "Crates worth knowing",
    linkCount: 2,
    updatedAt: "2026-11-14T10:00:00+00:00",
    owner: { id: OWNER_ID, username: "octocat", avatarUrl: null },
    followerCount: 12,
    ...overrides,
  };
}

export const COLLECTION: SharedCollection = {
  ...summary(),
  isFollowing: false,
  links: [
    { url: "https://serde.rs/", title: "Serde", host: "serde.rs", libraryId: "serde.rs" },
    { url: "https://tokio.rs/", title: "Tokio", host: "tokio.rs", libraryId: "tokio.rs" },
  ],
};

export const PREVIEW: SharePreview = {
  title: "Client work",
  description: "For Acme",
  links: [{ url: "https://motion.dev/", title: "Motion", host: "motion.dev" }],
  skipped: 2,
  sharedId: null,
};

/** A library holding Serde already. */
export const LIBRARY: LibrarySnapshot = {
  source: { browser: "", folder: "", warning: null },
  resources: [
    {
      id: "serde.rs",
      title: "Serde",
      url: "https://serde.rs/",
      host: "serde.rs",
      category: "tools",
      folder: "",
      addedAt: null,
      origin: "devatlas",
      isNew: false,
      categoryOverride: null,
      status: null,
      lastOpenedAt: null,
      linkHealth: null,
      tags: [],
      note: null,
    },
  ],
};
