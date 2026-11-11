import { format } from "date-fns";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";

import { Skeleton } from "@/components/ui/skeleton";
import { useResourcePreview } from "@/hooks/use-resource-preview";
import { CATEGORY_META } from "@/lib/resource-categories";
import { cn } from "@/lib/utils";
import type { Resource } from "@/types/library.types";

import { useResourceActions, viewerPath } from "../hooks/use-resource-actions";
import { EditResourceDialog } from "./edit-resource-dialog";

const cardAction =
  "rounded-full bg-black/55 p-2 text-white/90 opacity-0 backdrop-blur transition-opacity outline-none group-hover/card:opacity-100 hover:bg-black/75 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring";

/** Initial of the site's name: "ui.aceternity.com" → "A", "reactbits.dev" → "R". */
function siteInitial(host: string): string {
  const labels = host.split(".");
  const name = labels.length > 1 ? labels[labels.length - 2] : labels[0];
  return (name ?? host).charAt(0).toUpperCase();
}

/** A saved link with its preview image; opens the site inside DevAtlas. */
export function ResourceCard({ resource }: { resource: Resource }) {
  const preview = useResourcePreview(resource.url);
  const tint = CATEGORY_META[resource.category].tint;
  const { openExternally, remove } = useResourceActions(resource);
  const [editing, setEditing] = useState(false);

  return (
    <article className="group/card relative h-full rounded-xl border border-border bg-card transition-[border-color,box-shadow] duration-150 hover:border-foreground/15 hover:shadow-[0_10px_24px_-14px_rgb(0_0_0/0.7)]">
      <Link
        to={viewerPath(resource)}
        title={resource.url}
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
                    host={resource.host}
                    className="size-14 rounded-2xl text-xl"
                  />
                </div>
              }
            />
          )}
          {resource.isNew && (
            <span className="absolute top-2.5 left-2.5 rounded-full bg-highlight px-2.5 py-0.5 text-xs font-semibold text-highlight-foreground shadow-[0_1px_3px_rgb(0_0_0/0.4)]">
              New
            </span>
          )}
        </div>

        <div className="flex items-start gap-3 p-3">
          <SiteIcon
            icon={preview.data?.icon ?? null}
            host={resource.host}
            className={cn("size-9 rounded-lg bg-linear-to-br text-sm", tint)}
          />
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-sm leading-snug font-medium">{resource.title}</h3>
            <p className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="min-w-0 truncate font-mono">{resource.host}</span>
              {resource.addedAt !== null && (
                <span className="ml-auto shrink-0">
                  {resource.origin === "devatlas" ? "Added" : "Saved"}{" "}
                  {format(resource.addedAt, "MMM yyyy")}
                </span>
              )}
            </p>
            {resource.tags.length > 0 && <ResourceTags tags={resource.tags} className="mt-2" />}
          </div>
        </div>
      </Link>

      <div className="absolute top-2.5 right-2.5 flex gap-1.5">
        <button
          type="button"
          onClick={() => {
            setEditing(true);
          }}
          aria-label={`Edit ${resource.title}`}
          title="Edit category, tags and notes"
          className={cardAction}
        >
          <Pencil className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={remove}
          aria-label={`Remove ${resource.title} from your library`}
          title="Remove from library"
          className={cardAction}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={openExternally}
          aria-label={`Open ${resource.host} in your browser`}
          title="Open in your browser"
          className={cardAction}
        >
          <ExternalLink className="size-3.5" aria-hidden />
        </button>
      </div>
      {editing && (
        <EditResourceDialog
          resource={resource}
          onClose={() => {
            setEditing(false);
          }}
        />
      )}
    </article>
  );
}

/** A link's tags, as small chips. */
export function ResourceTags({ tags, className }: { tags: readonly string[]; className?: string }) {
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded-full bg-secondary px-2 py-px text-xs text-muted-foreground"
        >
          {tag}
        </span>
      ))}
    </span>
  );
}

interface RemoteImageProps {
  src: string | null;
  className?: string;
  fallback: ReactNode;
}

/** An image from another site; falls back when missing or when it fails to load. */
export function RemoteImage({ src, className, fallback }: RemoteImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (src === null || failedSrc === src) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        setFailedSrc(src);
      }}
      className={className}
    />
  );
}

export function SiteIcon({
  icon,
  host,
  className,
}: {
  icon: string | null;
  host: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden bg-foreground/[0.06] font-semibold text-tile-icon ring-1 ring-foreground/10 ring-inset",
        className,
      )}
    >
      <RemoteImage
        src={icon}
        className="size-full bg-white/90 object-contain p-1.5"
        fallback={siteInitial(host)}
      />
    </span>
  );
}
