import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Text } from "@astryxdesign/core/Text";
import { ToggleButton } from "@astryxdesign/core/ToggleButton";
import { VStack } from "@astryxdesign/core/VStack";
import { Compass } from "lucide-react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router";

import { PageHeader } from "@/components/shared/page-header";
import { ResourceCard } from "@/features/library";
import { useLibrary } from "@/hooks/use-library";
import { ECOSYSTEMS, ecosystemsOf } from "@/lib/ecosystems";
import type { Resource } from "@/types/library.types";

import { useRemovedSuggestions, useSuggestionActions } from "../hooks/use-suggestions";
import { SUGGESTED_LINKS, suggestionId, type SuggestedLink } from "../suggested-links";
import { SuggestedCard } from "./suggested-card";

const SUGGESTED_IDS = new Set(SUGGESTED_LINKS.map(({ url }) => suggestionId(url)));
const CARD_GRID = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3";

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
    <VStack gap={5} padding={6}>
      <PageHeader
        title="Explorer"
        description="Your library and suggested starting points, by language and framework."
      >
        {restorable.length > 0 && (
          <Button
            variant="ghost"
            label={`Restore ${String(restorable.length)} removed`}
            onClick={() => {
              restore(restorable);
            }}
          />
        )}
      </PageHeader>
      {(library.isPending || removed.isPending) && <BrowserSkeleton />}
      {library.isError && library.data === undefined && (
        <Banner
          role="alert"
          status="error"
          title="Your library couldn't be read"
          description={library.error.message.replace(/^.*?failed: /, "")}
        />
      )}
      {removed.isError && (
        <Banner role="alert" status="error" title="Suggested links aren't available right now." />
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
    </VStack>
  );
}

function BrowserSkeleton() {
  return (
    <VStack role="status" aria-busy="true" gap={5}>
      <span className="sr-only">Loading</span>
      <Skeleton height={36} width={384} />
      <div className={CARD_GRID}>
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} index={index} height={240} />
        ))}
      </div>
    </VStack>
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
      <EmptyState
        headingLevel={2}
        icon={<Icon icon={Compass} />}
        title="No ecosystems found yet"
        description="Links are grouped by words in their title and address, or by a tag such as “rust” or “react”."
      />
    );
  }
  const current = present.find(({ id }) => id === chosen) ?? present[0];
  const shown = tagged.filter(({ ids }) => current !== undefined && ids.includes(current.id));
  const shownSuggestions = suggestions.filter((link) => link.ecosystem === current?.id);

  return (
    <VStack gap={6}>
      <HStack role="group" aria-label="Ecosystem" gap={2} wrap="wrap">
        {present.map(({ id, label, count }) => (
          <ToggleButton
            key={id}
            size="sm"
            label={`${label} ${String(count)}`}
            isPressed={id === current?.id}
            onPressedChange={() => {
              onChoose(id);
            }}
          >
            {label}{" "}
            <Text type="supporting" color="inherit" hasTabularNumbers>
              {count}
            </Text>
          </ToggleButton>
        ))}
      </HStack>
      {shown.length > 0 && (
        <CardGroup title="In your library">
          {shown.map(({ resource }) => (
            <li key={resource.id}>
              <ResourceCard resource={resource} />
            </li>
          ))}
        </CardGroup>
      )}
      {shownSuggestions.length > 0 && (
        <CardGroup title="Suggested">
          {shownSuggestions.map((link) => (
            <li key={link.url}>
              <SuggestedCard link={link} onRemove={onRemove} />
            </li>
          ))}
        </CardGroup>
      )}
    </VStack>
  );
}

function CardGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <VStack gap={3}>
      <Heading level={2}>{title}</Heading>
      <ul className={CARD_GRID}>{children}</ul>
    </VStack>
  );
}
