import { X } from "lucide-react";
import { Link, useLocation } from "react-router";

import { Skeleton } from "@/components/ui/skeleton";
import { RemoteImage, SiteIcon } from "@/features/library";
import { useResourcePreview } from "@/hooks/use-resource-preview";

import type { SuggestedLink } from "../suggested-links";

/** A link DevAtlas suggests; opens inside the app and can be removed. */
export function SuggestedCard({
  link,
  onRemove,
}: {
  link: SuggestedLink;
  onRemove: (link: SuggestedLink) => void;
}) {
  const location = useLocation();
  const preview = useResourcePreview(link.url);
  const host = new URL(link.url).hostname.replace(/^www\./, "");

  return (
    <article className="group/card relative h-full rounded-xl border border-border bg-card transition-[border-color,box-shadow] duration-150 hover:border-foreground/15 hover:shadow-[0_10px_24px_-14px_rgb(0_0_0/0.7)]">
      <Link
        to={`/explorer/view?url=${encodeURIComponent(link.url)}`}
        state={{ from: `${location.pathname}${location.search}` }}
        title={link.url}
        className="flex h-full flex-col rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="relative aspect-[1200/630] overflow-hidden rounded-t-[inherit] border-b border-border bg-secondary">
          {preview.isPending ? (
            <Skeleton className="size-full rounded-none bg-foreground/[0.04]" />
          ) : (
            <RemoteImage
              src={preview.data?.image ?? null}
              className="size-full object-cover transition-transform duration-500 group-hover/card:scale-[1.03] motion-reduce:transition-none"
              fallback={
                <div className="flex size-full items-center justify-center">
                  <SiteIcon
                    icon={preview.data?.icon ?? null}
                    host={host}
                    className="size-14 rounded-2xl text-xl"
                  />
                </div>
              }
            />
          )}
          <span className="absolute top-2.5 left-2.5 rounded-full bg-black/55 px-2.5 py-0.5 text-xs font-medium text-white/90 backdrop-blur">
            Suggested
          </span>
        </div>
        <div className="flex items-start gap-3 p-3">
          <SiteIcon
            icon={preview.data?.icon ?? null}
            host={host}
            className="size-9 rounded-lg text-sm"
          />
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-sm leading-snug font-medium">{link.title}</h3>
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{host}</p>
            <p className="mt-1.5 text-xs text-muted-foreground">{link.description}</p>
          </div>
        </div>
      </Link>
      <button
        type="button"
        onClick={() => {
          onRemove(link);
        }}
        aria-label={`Remove ${link.title}`}
        title="Remove this suggestion"
        className="absolute top-2.5 right-2.5 rounded-full bg-black/55 p-2 text-white/90 opacity-0 backdrop-blur transition-opacity outline-none group-hover/card:opacity-100 hover:bg-black/75 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </article>
  );
}
