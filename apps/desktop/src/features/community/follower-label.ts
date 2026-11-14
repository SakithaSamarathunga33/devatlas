/** "1 follower", "12 followers". */
export function followerLabel(count: number): string {
  return `${String(count)} ${count === 1 ? "follower" : "followers"}`;
}
