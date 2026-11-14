import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  cancelCommunitySignIn,
  followSharedCollection,
  getCommunitySession,
  getSharedCollection,
  listMySharedCollections,
  listSharedCollections,
  previewGroupShare,
  signInToCommunity,
  signOutOfCommunity,
  unfollowSharedCollection,
} from "@/services/community.service";
import type { CommunityUser, SharedCollection } from "@/types/community.types";

import { errorMessage } from "../error-message";

/** Every Community query starts with this, so one invalidation refreshes them all. */
export const communityQueryKey = ["community"] as const;
const sessionQueryKey = [...communityQueryKey, "session"] as const;
const mineQueryKey = [...communityQueryKey, "mine"] as const;
const collectionQueryKey = (id: string) => [...communityQueryKey, "collection", id] as const;

/** `value`, once it has stopped changing for `delayMs`. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSettled(value);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);
  return settled;
}

/** The signed-in account, or `null`. The first read restores a stored session. */
export function useCommunitySession() {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: getCommunitySession,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/** Signing in through the browser; `cancel` stops waiting for it. */
export function useCommunitySignIn() {
  const queryClient = useQueryClient();
  const signIn = useMutation({
    mutationFn: signInToCommunity,
    onSuccess: (user: CommunityUser) => {
      // Another account's list must never show, even briefly.
      queryClient.removeQueries({ queryKey: mineQueryKey });
      queryClient.setQueryData(sessionQueryKey, user);
    },
  });
  const cancel = () => {
    // Forgetting the attempt first keeps its "cancelled" rejection out of the UI.
    signIn.reset();
    void cancelCommunitySignIn();
  };
  // Leaving the screen mid sign-in (say, choosing to stay local) stops the wait, so nobody is
  // signed in later behind their back. Once the attempt has settled this is a no-op.
  const isWaiting = signIn.isPending;
  useEffect(() => {
    if (!isWaiting) return;
    return () => {
      void cancelCommunitySignIn();
    };
  }, [isWaiting]);
  return { signIn, cancel };
}

export function useCommunitySignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: signOutOfCommunity,
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: mineQueryKey });
      queryClient.setQueryData(sessionQueryKey, null);
      await queryClient.invalidateQueries({ queryKey: communityQueryKey });
    },
  });
}

/** Published collections matching `query`, a page at a time. */
export function useSharedCollections(query: string) {
  const terms = query.trim();
  return useInfiniteQuery({
    queryKey: [...communityQueryKey, "collections", terms],
    queryFn: ({ pageParam }) => listSharedCollections(terms, pageParam),
    // The current results stay while a new search loads.
    placeholderData: keepPreviousData,
    initialPageParam: 0,
    getNextPageParam: (page) => page.nextOffset ?? undefined,
    staleTime: 60 * 1000,
    retry: false,
  });
}

export function useMySharedCollections(isEnabled: boolean) {
  return useQuery({
    queryKey: mineQueryKey,
    queryFn: listMySharedCollections,
    enabled: isEnabled,
    retry: false,
  });
}

export function useSharedCollection(id: string) {
  return useQuery({
    queryKey: collectionQueryKey(id),
    queryFn: () => getSharedCollection(id),
    retry: false,
  });
}

/**
 * Follows (`true`) or unfollows a collection. Its page shows the change at once, then the
 * server's follower count; a failure puts the page back and says why.
 */
export function useFollowCollection(id: string) {
  const queryClient = useQueryClient();
  const queryKey = collectionQueryKey(id);
  return useMutation({
    mutationFn: (follow: boolean) =>
      follow ? followSharedCollection(id) : unfollowSharedCollection(id),
    onMutate: async (follow) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SharedCollection>(queryKey);
      if (previous !== undefined) {
        queryClient.setQueryData<SharedCollection>(queryKey, {
          ...previous,
          isFollowing: follow,
          followerCount: Math.max(0, previous.followerCount + (follow ? 1 : -1)),
        });
      }
      return { previous };
    },
    onError: (error, follow, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(queryKey, context.previous);
      // The change may have reached the server before the failure: read back what is true.
      void queryClient.invalidateQueries({ queryKey });
      toast.error(
        follow ? "Couldn't follow this collection" : "Couldn't unfollow this collection",
        {
          description: errorMessage(error),
        },
      );
    },
    onSuccess: (state) => {
      queryClient.setQueryData<SharedCollection>(
        queryKey,
        (current) =>
          current && {
            ...current,
            isFollowing: state.following,
            followerCount: state.followerCount,
          },
      );
      // The cards show follower counts too; the button needn't wait for them.
      void queryClient.invalidateQueries({ queryKey: [...communityQueryKey, "collections"] });
    },
  });
}

/** What sharing a local collection would publish. */
export function useSharePreview(groupId: string) {
  return useQuery({
    queryKey: [...communityQueryKey, "share-preview", groupId],
    queryFn: () => previewGroupShare(groupId),
    retry: false,
  });
}
