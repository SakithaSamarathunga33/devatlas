import { ArrowLeft } from "lucide-react";
import { Link, useLocation, useSearchParams } from "react-router";
import { z } from "zod";

import { SiteViewer } from "@/components/shared/site-viewer";

const webUrl = z.url({ protocol: /^https?$/ });

const BACK_LABELS: Record<string, string> = {
  "/": "Back to dashboard",
  "/discovery": "Back to repos",
  "/explorer": "Back to Explorer",
  "/news": "Back to news",
  "/rankings": "Back to rankings",
};

/** Where to return: the in-app page the link was on, never an outside URL. */
function backTarget(state: unknown): string {
  const from =
    typeof state === "object" && state !== null && "from" in state ? state.from : undefined;
  return typeof from === "string" && from.startsWith("/") && !from.startsWith("//")
    ? from
    : "/news";
}

/** A news story, blog post, source page, GitHub repository or suggested link shown inside
 * DevAtlas. The URL lives in `?url=`. */
export function NewsViewerPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const backTo = backTarget(location.state);
  const backLabel = BACK_LABELS[backTo.split("?")[0] ?? ""] ?? "Back";
  const parsed = webUrl.safeParse(params.get("url"));

  if (!parsed.success) {
    return (
      <div className="mx-auto max-w-xl px-6 pt-16 text-sm text-muted-foreground">
        <p>This link can&apos;t be opened. Only web pages (http and https) are shown here.</p>
        <Link to={backTo} className="mt-4 inline-flex items-center gap-1.5 text-primary">
          <ArrowLeft className="size-4" aria-hidden />
          {backLabel}
        </Link>
      </div>
    );
  }

  const url = parsed.data;
  return (
    <SiteViewer
      key={url}
      url={url}
      host={new URL(url).hostname.replace(/^www\./, "")}
      backTo={backTo}
      backLabel={backLabel}
    />
  );
}
