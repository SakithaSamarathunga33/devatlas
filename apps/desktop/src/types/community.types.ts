import { z } from "zod";

const httpsUrl = z.url({ protocol: /^https$/ });

/** Mirrors `devatlas_application::community::CommunityUser`. */
export const communityUserSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  avatarUrl: httpsUrl.nullable(),
});
export type CommunityUser = z.infer<typeof communityUserSchema>;

/** Mirrors `devatlas_application::community::SharedSummary`. */
export const sharedSummarySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  linkCount: z.number().int().nonnegative(),
  updatedAt: z.string().min(1),
  owner: z.object({
    id: z.string().min(1),
    username: z.string().min(1),
    avatarUrl: httpsUrl.nullable(),
  }),
  followerCount: z.number().int().nonnegative(),
});
export type SharedSummary = z.infer<typeof sharedSummarySchema>;

export const sharedPageSchema = z.object({
  collections: z.array(sharedSummarySchema),
  nextOffset: z.number().int().nonnegative().nullable(),
});
export type SharedPage = z.infer<typeof sharedPageSchema>;

export const sharedLinkSchema = z.object({
  url: httpsUrl,
  title: z.string().min(1),
  host: z.string(),
  /** The id the link would have in the library. */
  libraryId: z.string().min(1),
});
export type SharedLink = z.infer<typeof sharedLinkSchema>;

/** Mirrors `devatlas_application::community::SharedCollection`. */
export const sharedCollectionSchema = sharedSummarySchema.extend({
  links: z.array(sharedLinkSchema),
  /** Whether the signed-in account follows it; `null` when signed out or unknown. */
  isFollowing: z.boolean().nullable(),
});
export type SharedCollection = z.infer<typeof sharedCollectionSchema>;

/** Mirrors `devatlas_application::community::FollowState`. */
export const followStateSchema = z.object({
  following: z.boolean(),
  followerCount: z.number().int().nonnegative(),
});
export type FollowState = z.infer<typeof followStateSchema>;

/** Mirrors `devatlas_application::community::SharePreview`: exactly what publishing sends. */
export const sharePreviewSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  links: z.array(z.object({ url: httpsUrl, title: z.string().min(1), host: z.string() })),
  /** Links left out because they aren't https. */
  skipped: z.number().int().nonnegative(),
  /** The published copy, when this collection was shared before. */
  sharedId: z.string().nullable(),
});
export type SharePreview = z.infer<typeof sharePreviewSchema>;
