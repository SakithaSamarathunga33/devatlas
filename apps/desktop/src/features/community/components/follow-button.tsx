// Adapted from Uiverse.io element "popular-puma-87" by Priyanshu02020 (MIT licence).
import { useState } from "react";

import type { SharedCollection } from "@/types/community.types";

import { followerLabel } from "../follower-label";
import { useFollowCollection } from "../hooks/use-community";

const HEART_PATH =
  "m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z";

function Heart() {
  return (
    <svg className="follow-button__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={HEART_PATH} />
    </svg>
  );
}

/** The count, sliding to each new value: up when it grows, down when it shrinks. */
function SlidingCount({ count }: { count: number }) {
  const [shown, setShown] = useState({ current: count, previous: count });
  if (shown.current !== count) setShown({ current: count, previous: shown.current });
  const hasChanged = shown.current !== shown.previous;
  return (
    <span
      className="follow-button__count"
      data-direction={shown.current > shown.previous ? "up" : "down"}
      aria-hidden="true"
    >
      {hasChanged && (
        <span
          key={`out-${String(shown.previous)}-${String(shown.current)}`}
          className="follow-button__number follow-button__number--out"
        >
          {shown.previous}
        </span>
      )}
      <span
        key={`in-${String(shown.current)}`}
        className={
          hasChanged ? "follow-button__number follow-button__number--in" : "follow-button__number"
        }
      >
        {shown.current}
      </span>
    </span>
  );
}

/** Follows or unfollows a collection someone else shared, with its follower count. */
export function FollowButton({ collection }: { collection: SharedCollection }) {
  const follow = useFollowCollection(collection.id);
  const isFollowing = collection.isFollowing === true;
  const label = isFollowing ? "Following" : "Follow";
  // The heart pops when clicked, not when the page opens on a followed collection.
  const [hasClicked, setHasClicked] = useState(false);

  return (
    <button
      type="button"
      className="follow-button"
      aria-pressed={isFollowing}
      aria-label={`${label}, ${followerLabel(collection.followerCount)}`}
      data-clicked={hasClicked || undefined}
      onClick={() => {
        setHasClicked(true);
        // One change at a time, so a rollback never undoes a newer click.
        if (!follow.isPending) follow.mutate(!isFollowing);
      }}
    >
      <span className="follow-button__main">
        <Heart />
        <span className="follow-button__label">{label}</span>
      </span>
      <SlidingCount count={collection.followerCount} />
    </button>
  );
}

/** The owner's view: the count only, since nobody follows their own collection. */
export function FollowerCount({ count }: { count: number }) {
  return (
    <p className="follow-button follow-button--static">
      <span className="sr-only">{followerLabel(count)}</span>
      <span className="follow-button__main" aria-hidden="true">
        <Heart />
        <span className="follow-button__label">Followers</span>
      </span>
      <SlidingCount count={count} />
    </p>
  );
}
