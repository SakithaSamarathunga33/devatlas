import { ArrowRight, LibraryBig } from "lucide-react";
import { Link } from "react-router";

import Loader from "@/components/kokonutui/loader";
import { IconTile } from "@/components/shared/icon-tile";
import { MagicCard } from "@/components/ui/magic-card";
import { useLibrary } from "@/hooks/use-library";
import { CATEGORY_META, countByCategory } from "@/lib/resource-categories";
import type { Resource } from "@/types/library.types";

/** Dashboard overview of the library read from Brave. */
export function LibrarySummary() {
  const query = useLibrary();

  return (
    <MagicCard className="h-full">
      <section aria-labelledby="library-summary-heading" className="flex h-full flex-col p-6">
        <div className="flex items-center gap-3">
          <IconTile icon={LibraryBig} />
          <div>
            <h2 id="library-summary-heading" className="text-sm font-semibold">
              Your library
            </h2>
            <p className="text-xs text-muted-foreground">
              {query.isSuccess
                ? `Read live from ${query.data.source.browser} › ${query.data.source.folder}`
                : "Read live from your Brave bookmarks"}
            </p>
          </div>
        </div>

        {query.isPending && (
          <Loader size="sm" title="Reading bookmarks" subtitle="" className="p-4" />
        )}

        {query.isError && (
          <p role="alert" className="mt-5 text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-destructive">Library unavailable. </span>
            {query.error.message}
          </p>
        )}

        {query.isSuccess && query.data.resources.length === 0 && (
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            No bookmarks found in {query.data.source.browser} › {query.data.source.folder} yet.
          </p>
        )}

        {query.isSuccess && query.data.resources.length > 0 && (
          <CategoryBreakdown resources={query.data.resources} />
        )}

        <Link
          to="/library"
          className="mt-auto inline-flex items-center gap-1.5 self-start rounded-md pt-5 text-sm text-violet-200 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-ring"
        >
          Open library
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </section>
    </MagicCard>
  );
}

function CategoryBreakdown({ resources }: { resources: readonly Resource[] }) {
  const total = resources.length;
  const newCount = resources.filter((resource) => resource.isNew).length;
  return (
    <>
      <p className="mt-5 flex items-baseline text-3xl font-semibold tracking-tight tabular-nums">
        {total}
        <span className="ml-2 text-sm font-normal text-muted-foreground">resources</span>
        {newCount > 0 && (
          <span className="ml-3 self-center rounded-full bg-linear-to-r from-primary to-info px-2.5 py-0.5 text-xs font-semibold text-white">
            {newCount} new
          </span>
        )}
      </p>
      <ul className="mt-4 space-y-2.5">
        {countByCategory(resources).map(({ category, count }) => (
          <li
            key={category}
            className="grid grid-cols-[8.5rem_1fr_2rem] items-center gap-3 text-xs"
          >
            <span className="truncate text-muted-foreground">{CATEGORY_META[category].label}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <span
                className="block h-full rounded-full bg-linear-to-r from-primary to-info"
                style={{ width: `${String((count / total) * 100)}%` }}
              />
            </span>
            <span className="text-right tabular-nums">{count}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
