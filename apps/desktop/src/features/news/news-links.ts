/** In-app viewer route for a news link. */
export function newsViewerPath(url: string): string {
  return `/news/view?url=${encodeURIComponent(url)}`;
}

/** "https://www.example.com/a" → "example.com". */
export function siteHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
