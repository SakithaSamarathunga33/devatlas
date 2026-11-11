import { CircleAlert } from "lucide-react";
import { useSearchParams } from "react-router";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ResourceCard } from "@/features/library";
import { useLibrary } from "@/hooks/use-library";
import { ECOSYSTEMS, ecosystemsOf } from "@/lib/ecosystems";
import { cn } from "@/lib/utils";
import type { Resource } from "@/types/library.types";

import { useRemovedSuggestions, useSuggestionActions } from "../hooks/use-suggestions";
import { SUGGESTED_LINKS, suggestionId, type SuggestedLink } from "../suggested-links";
import { SuggestedCard } from "./suggested-card";

const SUGGESTED_IDS = new Set(SUGGESTED_LINKS.map(({ url }) => suggestionId(url)));

/** Browses the library and suggested links by ecosystem. The chosen one lives in `?ecosystem=`. */
export function ExplorerPage() {
  const library = useLibrary();
  const removed = useRemovedSuggestions();
  const { remove, restore } = useSuggestionActions();
  const [params, setParams] = useSearchParams();
  const removedIds = removed.data ?? [];
  const libraryIds = new Set(library.data?.resources.map(({ id }) => id));
  const restorable = removedIds.filter((id) => SUGGESTED_IDS.has(id) && !libraryIds.has(id));

  return (
    <div className="w-full px-5 pt-5 pb-16 lg:px-8">
      <PageHeader
        title="Explorer"
        description="Your library and suggested starting points, by language and framework."
      >
        {restorable.length > 0 && (
          <Button
            variant="ghost"
            onClick={() => {
              restore(restorable);
            }}
          >
            Restore {restorable.length} removed
          </Button>
        )}
      </PageHeader>
      {(library.isPending || removed.isPending) && (
        <div role="status" aria-busy="true" className="mt-5">
          <span className="sr-only">Loading</span>
          <Skeleton className="h-10 w-96 rounded-lg" />
        </div>
      )}
      {library.isError && library.data === undefined && (
        <p role="alert" className="mt-8 flex items-center gap-2 text-sm text-destructive">
          <CircleAlert className="size-4 shrink-0" aria-hidden />
          {library.error.message}
        </p>
      )}
      {removed.isError && (
        <p role="alert" className="mt-8 flex items-center gap-2 text-sm text-destructive">
          <CircleAlert className="size-4 shrink-0" aria-hidden />
          Suggested links aren&apos;t available right now.
        </p>
      )}
      {library.data !== undefined && !removed.isPending && (
        <Browser
          resources={library.data.resources}
          suggested={removed.isSuccess ? SUGGESTED_LINKS : []}
          removedIds={removedIds}
          chosen={params.get("ecosystem")}
          onChoose={(id) => {
            setParams({ ecosystem: id }, { replace: true });
          }}
          onRemove={remove}
        />
      )}
    </div>
  );
}

function Browser({
  resources,
  suggested,
  removedIds,
  chosen,
  onChoose,
  onRemove,
}: {
  resources: readonly Resource[];
  suggested: readonly SuggestedLink[];
  removedIds: readonly string[];
  chosen: string | null;
  onChoose: (id: string) => void;
  onRemove: (link: SuggestedLink) => void;
}) {
  const tagged = resources.map((resource) => ({ resource, ids: ecosystemsOf(resource) }));
  const hidden = new Set([...removedIds, ...resources.map(({ id }) => id)]);
  const suggestions = suggested.filter(({ url }) => !hidden.has(suggestionId(url)));
  const present = ECOSYSTEMS.map((ecosystem) => ({
    ...ecosystem,
    count:
      tagged.filter(({ ids }) => ids.includes(ecosystem.id)).length +
      suggestions.filter((link) => link.ecosystem === ecosystem.id).length,
  })).filter(({ count }) => count > 0);

  if (present.length === 0) {
    return (
      <p className="mt-8 max-w-[65ch] text-sm text-muted-foreground">
        No ecosystems found yet. Links are grouped by words in their title and address, or by a tag
        such as &ldquo;rust&rdquo; or &ldquo;react&rdquo;.
      </p>
    );
  }
  const current = present.find(({ id }) => id === chosen) ?? present[0];
  const shown = tagged.filter(({ ids }) => current !== undefined && ids.includes(current.id));
  const shownSuggestions = suggestions.filter((link) => link.ecosystem === current?.id);

  return (
    <>
      <div role="group" aria-label="Ecosystem" className="mt-4 flex flex-wrap gap-2">
        {present.map(({ id, label, count }) => (
          <button
            key={id}
            type="button"
            aria-pressed={id === current?.id}
            onClick={() => {
              onChoose(id);
            }}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
              id === current?.id
                ? "border-transparent bg-primary font-medium text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            <span className="text-xs tabular-nums">{count}</span>
          </button>
        ))}
      </div>
      <ul className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3">
        {shown.map(({ resource }) => (
          <li key={resource.id}>
            <ResourceCard resource={resource} />
          </li>
        ))}
        {shownSuggestions.map((link) => (
          <li key={link.url}>
            <SuggestedCard link={link} onRemove={onRemove} />
          </li>
        ))}
      </ul>
    </>
  );
}
