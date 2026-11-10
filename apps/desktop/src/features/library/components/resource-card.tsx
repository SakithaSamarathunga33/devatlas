import { format } from "date-fns";
import { ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

import { MagicCard } from "@/components/ui/magic-card";
import { CATEGORY_META } from "@/lib/resource-categories";
import { cn } from "@/lib/utils";
import { openResource } from "@/services/library.service";
import type { Resource } from "@/types/library.types";

/** Initial of the site's name: "ui.aceternity.com" → "A", "reactbits.dev" → "R". */
function siteInitial(host: string): string {
  const labels = host.split(".");
  const name = labels.length > 1 ? labels[labels.length - 2] : labels[0];
  return (name ?? host).charAt(0).toUpperCase();
}

/** A saved link; activating it opens the site in the system browser. */
export function ResourceCard({ resource }: { resource: Resource }) {
  const open = () => {
    openResource(resource.url).catch((error: unknown) => {
      toast.error(`Couldn't open ${resource.host}`, {
        description: error instanceof Error ? error.message : "The link could not be opened.",
      });
    });
  };

  return (
    <MagicCard className="h-full rounded-xl" gradientSize={170}>
      <button
        type="button"
        onClick={open}
        title={resource.url}
        className="group/card flex h-full w-full items-start gap-3.5 rounded-[inherit] p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          aria-hidden
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg bg-linear-to-br text-sm font-semibold text-white ring-1 ring-white/10 ring-inset",
            CATEGORY_META[resource.category].tint,
          )}
        >
          {siteInitial(resource.host)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-sm leading-snug font-medium">{resource.title}</span>
          <span className="mt-1 block truncate font-mono text-xs text-muted-foreground">
            {resource.host}
          </span>
          {resource.addedAt !== null && (
            <span className="mt-2 block text-[11px] text-muted-foreground/70">
              Saved {format(resource.addedAt, "MMM yyyy")}
            </span>
          )}
        </span>
        <ArrowUpRight
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/card:opacity-100 group-focus-visible/card:opacity-100"
        />
      </button>
    </MagicCard>
  );
}
