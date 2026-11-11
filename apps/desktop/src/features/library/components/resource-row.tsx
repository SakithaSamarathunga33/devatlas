import { format } from "date-fns";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { useResourcePreview } from "@/hooks/use-resource-preview";
import { CATEGORY_META } from "@/lib/resource-categories";
import { cn } from "@/lib/utils";
import type { Resource } from "@/types/library.types";

import { useResourceActions, viewerPath } from "../hooks/use-resource-actions";
import { EditResourceDialog } from "./edit-resource-dialog";
import { ResourceTags, SiteIcon } from "./resource-card";

const rowAction =
  "rounded-md p-2 text-muted-foreground opacity-0 transition-opacity outline-none group-hover/row:opacity-100 hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4";

/** Compact list-view entry for a resource; opens the site inside DevAtlas. */
export function ResourceRow({ resource }: { resource: Resource }) {
  const preview = useResourcePreview(resource.url);
  const { label, tint } = CATEGORY_META[resource.category];
  const { openExternally, remove } = useResourceActions(resource);
  const [editing, setEditing] = useState(false);

  return (
    <article className="group/row flex items-center gap-2 rounded-xl pr-2 transition-colors hover:bg-accent/60">
      <Link
        to={viewerPath(resource)}
        title={resource.url}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <SiteIcon
          icon={preview.data?.icon ?? null}
          host={resource.host}
          className={cn("size-9 rounded-lg bg-linear-to-br text-sm", tint)}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{resource.title}</span>
            {resource.isNew && (
              <span className="shrink-0 rounded-full bg-highlight px-2 py-px text-xs font-semibold text-highlight-foreground">
                New
              </span>
            )}
          </span>
          <span className="block truncate font-mono text-xs text-muted-foreground">
            {resource.host}
          </span>
          {resource.tags.length > 0 && <ResourceTags tags={resource.tags} className="mt-1" />}
        </span>
        <span className="hidden w-36 shrink-0 truncate text-xs text-muted-foreground md:block">
          {label}
        </span>
        <span className="hidden w-20 shrink-0 text-right text-xs text-muted-foreground tabular-nums sm:block">
          {resource.addedAt === null ? "" : format(resource.addedAt, "MMM yyyy")}
        </span>
      </Link>
      <button
        type="button"
        onClick={() => {
          setEditing(true);
        }}
        aria-label={`Edit ${resource.title}`}
        title="Edit category, tags and notes"
        className={rowAction}
      >
        <Pencil aria-hidden />
      </button>
      <button
        type="button"
        onClick={remove}
        aria-label={`Remove ${resource.title} from your library`}
        title="Remove from library"
        className={rowAction}
      >
        <Trash2 aria-hidden />
      </button>
      <button
        type="button"
        onClick={openExternally}
        aria-label={`Open ${resource.host} in your browser`}
        title="Open in your browser"
        className={rowAction}
      >
        <ExternalLink aria-hidden />
      </button>
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
