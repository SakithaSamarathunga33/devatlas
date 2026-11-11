import { toast } from "sonner";

import { describeError } from "@/services/ipc";
import { openInBrowser } from "@/services/library.service";

/** Opens a page in the system browser, reporting failure; the app webview never navigates. */
export function openExternal(url: string, label: string) {
  openInBrowser(url).catch((error: unknown) => {
    toast.error(`Couldn't open ${label}`, { description: describeError(error) });
  });
}

/** Languages offered in the Trending filter, with GitHub's own colours (data, not theme). */
export const LANGUAGE_COLORS = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572a5",
  Rust: "#dea584",
  Go: "#00add8",
  Java: "#b07219",
  "C++": "#f34b7d",
  "C#": "#178600",
  Swift: "#f05138",
  Kotlin: "#a97bff",
  PHP: "#4f5d95",
  Ruby: "#701516",
  Dart: "#00b4ab",
  Zig: "#ec915c",
} as const satisfies Record<string, string>;
export type Language = keyof typeof LANGUAGE_COLORS;
export const LANGUAGES = Object.keys(LANGUAGE_COLORS) as Language[];

export function languageColor(language: string): string | undefined {
  return (LANGUAGE_COLORS as Record<string, string | undefined>)[language];
}

export const compactNumber = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Library id of a GitHub repository, matching how the backend names resources. */
export function libraryId(fullName: string): string {
  return `github.com/${fullName}`.toLowerCase();
}

/** First path segments on github.com that are GitHub pages, not repository owners. */
const RESERVED_OWNERS = new Set([
  "about",
  "collections",
  "explore",
  "features",
  "issues",
  "login",
  "marketplace",
  "notifications",
  "orgs",
  "pricing",
  "pulls",
  "search",
  "settings",
  "sponsors",
  "topics",
  "trending",
]);

/** `owner/name` when `url` is a GitHub repository's home page, otherwise `null`. */
export function githubFullName(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.hostname !== "github.com" && parsed.hostname !== "www.github.com") return null;
  const parts = parsed.pathname.split("/").filter((part) => part !== "");
  const [owner, name] = parts;
  if (parts.length !== 2 || owner === undefined || name === undefined) return null;
  if (RESERVED_OWNERS.has(owner.toLowerCase())) return null;
  return `${owner}/${name.replace(/\.git$/, "")}`;
}
