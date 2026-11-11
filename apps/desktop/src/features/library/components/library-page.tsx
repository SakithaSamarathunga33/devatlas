import { AspectRatio } from "@astryxdesign/core/AspectRatio";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { List } from "@astryxdesign/core/List";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Text } from "@astryxdesign/core/Text";
import { ToggleButton, ToggleButtonGroup } from "@astryxdesign/core/ToggleButton";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import { VStack } from "@astryxdesign/core/VStack";
import { Bookmark, LayoutGrid, List as ListIcon, Plus, RotateCw, SearchX, X } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";

import { FilterTabs } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { SearchField } from "@/components/shared/search-field";
import { useLibrary } from "@/hooks/use-library";
import { CATEGORY_META, countByCategory, STATUS_LABELS } from "@/lib/resource-categories";
import {
  readingStatuses,
  resourceCategories,
  type LibrarySnapshot,
  type ReadingStatus,
  type Resource,
  type ResourceCategory,
} from "@/types/library.types";

import { AddLinkForm } from "./add-link-form";
import { PREVIEW_RATIO, ResourceCard } from "./resource-card";
import { ResourceRow } from "./resource-row";

const CARD_COLUMNS = { minWidth: 280 };

type CategoryFilter = ResourceCategory | ReadingStatus | "all" | "new" | "broken";
type View = "grid" | "list";

function parseFilter(value: string | null): CategoryFilter {
  if (value === "new" || value === "broken") return value;
  return (
    readingStatuses.find((status) => status === value) ??
    resourceCategories.find((category) => category === value) ??
    "all"
  );
}

function inFilter(resource: Resource, filter: CategoryFilter): boolean {
  if (filter === "all") return true;
  if (filter === "new") return resource.isNew;
  if (filter === "broken") return resource.linkHealth === "broken";
  return resource.category === filter || resource.status === filter;
}

function librarySummary({ source, resources }: LibrarySnapshot): string {
  if (source.browser === "") {
    const noun = resources.length === 1 ? "resource" : "resources";
    return `${String(resources.length)} developer ${noun}, added in DevAtlas.`;
  }
  const fromBrowser = resources.filter((resource) => resource.origin === "browser").length;
  const added = resources.length - fromBrowser;
  const browserPart = `${String(fromBrowser)} from ${source.browser} › ${source.folder}`;
  return added === 0
    ? `${String(resources.length)} developer resources: ${browserPart}, read live from your bookmarks.`
    : `${String(resources.length)} developer resources: ${browserPart}, and ${String(added)} added in DevAtlas.`;
}

/** The library. Search (`q`), category (`filter`) and the add-link panel (`add`) live in
 * the URL, so the dashboard and the header search can link straight into a view. */
export function LibraryPage() {
  const [params, setParams] = useSearchParams();
  const query = useLibrary();
  const [view, setView] = useState<View>("grid");
  const adding = params.get("add") === "1";

  const setParam = (key: string, value: string | null) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  };

  return (
    <VStack gap={4} padding={6}>
      <PageHeader
        title="Library"
        description={
          query.isSuccess ? librarySummary(query.data) : "Your developer links, in one place."
        }
      >
        <HStack gap={2} vAlign="center" className="max-w-xl min-w-0 flex-1 basis-80">
          <SearchField
            value={params.get("q") ?? ""}
            onChange={(value) => {
              setParam("q", value);
            }}
            label="Search library"
            placeholder="Search…"
          />
          {query.isSuccess && query.data.resources.length > 0 && (
            <ToggleButtonGroup
              label="Layout"
              value={view}
              onChange={(next) => {
                // Pressing the active view reports null; one view always stays selected.
                if (next === "grid" || next === "list") setView(next);
              }}
            >
              <ToggleButton
                isIconOnly
                value="grid"
                label="Grid view"
                icon={<Icon icon={LayoutGrid} />}
              />
              <ToggleButton
                isIconOnly
                value="list"
                label="List view"
                icon={<Icon icon={ListIcon} />}
              />
            </ToggleButtonGroup>
          )}
          <Button
            variant="primary"
            label="Add link"
            icon={<Icon icon={adding ? X : Plus} />}
            aria-expanded={adding}
            aria-controls="add-link-panel"
            onClick={() => {
              setParam("add", adding ? null : "1");
            }}
          />
        </HStack>
      </PageHeader>
      {adding && (
        <div id="add-link-panel">
          <AddLinkForm autoFocus />
        </div>
      )}

      {query.isPending && <LibrarySkeleton />}

      {query.isError && (
        <Banner
          role="alert"
          status="error"
          title="Library unavailable"
          description={query.error.message}
          endContent={
            <Button
              label="Try again"
              icon={<Icon icon={RotateCw} />}
              isDisabled={query.isFetching}
              onClick={() => void query.refetch()}
            />
          }
        />
      )}

      {query.isSuccess && query.data.source.warning !== null && (
        <Banner
          role="alert"
          status="warning"
          title="Your browser's bookmarks can't be read"
          description={query.data.source.warning}
          endContent={<Button label="Open Settings" href="/settings" />}
        />
      )}

      {query.isSuccess && (
        <LibraryBrowser
          snapshot={query.data}
          category={parseFilter(params.get("filter"))}
          onCategoryChange={(value) => {
            setParam("filter", value === "all" ? null : value);
          }}
          search={params.get("q") ?? ""}
          view={view}
        />
      )}
    </VStack>
  );
}

interface LibraryBrowserProps {
  snapshot: LibrarySnapshot;
  category: CategoryFilter;
  onCategoryChange: (category: CategoryFilter) => void;
  search: string;
  view: View;
}

function LibraryBrowser({
  snapshot,
  category,
  onCategoryChange,
  search,
  view,
}: LibraryBrowserProps) {
  if (snapshot.resources.length === 0) {
    // The warning above already says why there is nothing.
    if (snapshot.source.warning !== null) return null;
    return snapshot.source.browser === "" ? (
      <EmptyState
        icon={<Icon icon={Bookmark} size="lg" />}
        title="No links yet"
        description="Add one with Add link, or choose a browser to read bookmarks from in Settings."
        headingLevel={2}
        actions={<Button label="Settings" href="/settings" />}
      />
    ) : (
      <EmptyState
        icon={<Icon icon={Bookmark} size="lg" />}
        title={`No bookmarks found in ${snapshot.source.browser} › ${snapshot.source.folder}`}
        description="Save links into that folder and they appear here."
        headingLevel={2}
      />
    );
  }

  const newCount = snapshot.resources.filter((resource) => resource.isNew).length;
  const brokenCount = snapshot.resources.filter(
    (resource) => resource.linkHealth === "broken",
  ).length;
  const statusCounts = readingStatuses
    .map((value) => ({
      value,
      label: STATUS_LABELS[value],
      count: snapshot.resources.filter((resource) => resource.status === value).length,
    }))
    .filter(({ count }) => count > 0);
  // A filter whose last link just left it would otherwise show an empty page.
  const filter = snapshot.resources.some((resource) => inFilter(resource, category))
    ? category
    : "all";
  const term = search.trim().toLowerCase();
  const visible = snapshot.resources.filter(
    (resource) =>
      inFilter(resource, filter) &&
      (term === "" ||
        [resource.title, resource.host, resource.note ?? "", ...resource.tags].some((text) =>
          text.toLowerCase().includes(term),
        )),
  );
  const groups = resourceCategories
    .map((group) => ({
      category: group,
      // New resources first; the stable sort keeps the title order otherwise.
      items: visible
        .filter((resource) => resource.category === group)
        .sort((a, b) => Number(b.isNew) - Number(a.isNew)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <VStack gap={6}>
      <FilterTabs
        label="Filter by category"
        value={filter}
        onChange={onCategoryChange}
        options={[
          { value: "all", label: "All", count: snapshot.resources.length },
          ...(newCount > 0 ? [{ value: "new" as const, label: "New", count: newCount }] : []),
          ...(brokenCount > 0
            ? [{ value: "broken" as const, label: "Broken", count: brokenCount }]
            : []),
          ...statusCounts,
          ...countByCategory(snapshot.resources).map(({ category: value, count }) => ({
            value,
            label: CATEGORY_META[value].label,
            count,
          })),
        ]}
      />

      {groups.length === 0 && (
        <EmptyState
          icon={<Icon icon={SearchX} size="lg" />}
          title={`No resources match “${search}”`}
          description="Try a different word, or clear the search."
          headingLevel={2}
        />
      )}

      {groups.map(({ category: group, items }) => {
        const { label, icon: CategoryIcon } = CATEGORY_META[group];
        return (
          <VStack as="section" key={group} gap={3} aria-labelledby={`category-${group}`}>
            <HStack gap={2} vAlign="center">
              <Icon icon={CategoryIcon} size="sm" color="accent" />
              <Heading level={2} id={`category-${group}`}>
                {label}
              </Heading>
              <Text type="supporting" hasTabularNumbers>
                {items.length}
              </Text>
            </HStack>
            {view === "grid" ? (
              <Grid role="list" columns={CARD_COLUMNS} gap={3}>
                {items.map((resource) => (
                  <div role="listitem" key={resource.id}>
                    <ResourceCard resource={resource} />
                  </div>
                ))}
              </Grid>
            ) : (
              <Card padding={0}>
                <List hasDividers edge="bleed">
                  {items.map((resource) => (
                    <ResourceRow key={resource.id} resource={resource} />
                  ))}
                </List>
              </Card>
            )}
          </VStack>
        );
      })}
    </VStack>
  );
}

/** Card-shaped placeholders while Brave's bookmarks are read. */
function LibrarySkeleton() {
  return (
    <VStack role="status" aria-busy="true" gap={4}>
      <VisuallyHidden>Reading your library</VisuallyHidden>
      <Skeleton width={160} height={20} />
      <Grid columns={CARD_COLUMNS} gap={3}>
        {Array.from({ length: 6 }, (_, index) => (
          <Card key={index} padding={0}>
            <AspectRatio ratio={PREVIEW_RATIO}>
              <Skeleton radius="none" index={index} />
            </AspectRatio>
            <HStack gap={3} padding={3}>
              <Skeleton width={36} height={36} />
              <VStack gap={2} className="flex-1">
                <Skeleton width="75%" height={16} />
                <Skeleton width="50%" height={12} />
              </VStack>
            </HStack>
          </Card>
        ))}
      </Grid>
    </VStack>
  );
}
