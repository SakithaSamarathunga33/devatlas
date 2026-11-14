import { z } from "zod";

import { invokeCommand } from "@/services/ipc";
import {
  communityUserSchema,
  followStateSchema,
  sharedCollectionSchema,
  sharedPageSchema,
  sharePreviewSchema,
  sharedSummarySchema,
  type CommunityUser,
  type FollowState,
  type SharedCollection,
  type SharedPage,
  type SharePreview,
  type SharedSummary,
} from "@/types/community.types";

/** The signed-in Community account, or `null`. */
export function getCommunitySession(): Promise<CommunityUser | null> {
  return invokeCommand("community_session", communityUserSchema.nullable());
}

/** Opens GitHub sign-in in the browser; resolves when the browser comes back. */
export function signInToCommunity(): Promise<CommunityUser> {
  return invokeCommand("community_sign_in", communityUserSchema);
}

export function cancelCommunitySignIn(): Promise<null> {
  return invokeCommand("community_cancel_sign_in", z.null());
}

export function signOutOfCommunity(): Promise<null> {
  return invokeCommand("community_sign_out", z.null());
}

export function listSharedCollections(query: string, offset: number): Promise<SharedPage> {
  return invokeCommand("list_shared_collections", sharedPageSchema, {
    query: query.trim() === "" ? null : query,
    offset,
  });
}

export function listMySharedCollections(): Promise<SharedSummary[]> {
  return invokeCommand("my_shared_collections", z.array(sharedSummarySchema));
}

export function getSharedCollection(id: string): Promise<SharedCollection> {
  return invokeCommand("get_shared_collection", sharedCollectionSchema, { id });
}

/** What sharing a local collection would make public. */
export function previewGroupShare(groupId: string): Promise<SharePreview> {
  return invokeCommand("preview_group_share", sharePreviewSchema, { groupId });
}

/** Publishes a local collection (or updates its copy); the backend reads the links itself. */
export function shareGroup(groupId: string): Promise<string> {
  return invokeCommand("share_group", z.string().min(1), { groupId });
}

export function unshareCollection(id: string): Promise<null> {
  return invokeCommand("unshare_collection", z.null(), { id });
}

/** `false` when this account had already reported the collection. */
export function reportSharedCollection(id: string, reason: string | null): Promise<boolean> {
  return invokeCommand("report_shared_collection", z.boolean(), { id, reason });
}

/** Follows a collection; resolves to the new state with the server's follower count. */
export function followSharedCollection(id: string): Promise<FollowState> {
  return invokeCommand("follow_shared_collection", followStateSchema, { id });
}

export function unfollowSharedCollection(id: string): Promise<FollowState> {
  return invokeCommand("unfollow_shared_collection", followStateSchema, { id });
}
