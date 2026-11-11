/** Words too generic to say what someone is interested in. */
const GENERIC = new Set([
  "api",
  "app",
  "cli",
  "core",
  "lib",
  "test",
  "types",
  "ui",
  "utils",
  "web",
]);

/** What the user cares about, from their tags and library ecosystems. */
export function buildInterests(tags: readonly string[], ecosystems: readonly string[]): string[] {
  const terms = [...tags, ...ecosystems].map((word) => word.trim().toLowerCase());
  return [...new Set(terms)].filter((word) => word.length >= 2 && !GENERIC.has(word));
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A test for whether text mentions any interest as a whole word. */
export function interestMatcher(interests: readonly string[]): (text: string) => boolean {
  if (interests.length === 0) return () => false;
  const pattern = new RegExp(
    `(?<![\\w-])(?:${interests.map(escapeRegex).join("|")})(?![\\w-])`,
    "i",
  );
  return (text) => pattern.test(text);
}
