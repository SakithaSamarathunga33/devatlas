import { HStack } from "@astryxdesign/core/HStack";
import { ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { format } from "date-fns";
import { useState } from "react";

import { useResourcePreview } from "@/hooks/use-resource-preview";
import { CATEGORY_META } from "@/lib/resource-categories";
import type { Resource } from "@/types/library.types";

import { viewerPath } from "../hooks/use-resource-actions";
import { EditResourceDialog } from "./edit-resource-dialog";
import { ResourceActions, ResourceBadges, ResourceTags, SiteIcon } from "./resource-card";

/** Compact list-view entry for a resource; opens the site inside DevAtlas. */
export function ResourceRow({ resource }: { resource: Resource }) {
  const preview = useResourcePreview(resource.url);
  const [editing, setEditing] = useState(false);

  return (
    <>
      <ListItem
        href={viewerPath(resource)}
        startContent={
          <SiteIcon
            icon={preview.data?.icon ?? null}
            host={resource.host}
            className="size-9 rounded-lg text-sm"
          />
        }
        label={
          <span title={resource.url} className="flex min-w-0 items-center gap-2">
            <Text weight="medium" maxLines={1}>
              {resource.title}
            </Text>
            <ResourceBadges resource={resource} />
          </span>
        }
        description={
          <VStack as="span" gap={1}>
            <Text type="code" size="xsm" color="secondary" maxLines={1}>
              {resource.host}
            </Text>
            {(resource.tags.length > 0 || resource.status !== null) && (
              <ResourceTags tags={resource.tags} status={resource.status} />
            )}
          </VStack>
        }
        endContent={
          <HStack gap={3} vAlign="center">
            <span className="hidden w-36 md:block">
              <Text type="supporting" maxLines={1}>
                {CATEGORY_META[resource.category].label}
              </Text>
            </span>
            <span className="hidden w-20 sm:block">
              <Text type="supporting" justify="end" hasTabularNumbers display="block">
                {resource.addedAt === null ? "" : format(resource.addedAt, "MMM yyyy")}
              </Text>
            </span>
            <ResourceActions
              resource={resource}
              onEdit={() => {
                setEditing(true);
              }}
            />
          </HStack>
        }
      />
      {/* Outside the row: a click inside the dialog must not reach the row's link. */}
      {editing && (
        <EditResourceDialog
          resource={resource}
          onClose={() => {
            setEditing(false);
          }}
        />
      )}
    </>
  );
}
