import { AspectRatio } from "@astryxdesign/core/AspectRatio";
import { Badge } from "@astryxdesign/core/Badge";
import { Center } from "@astryxdesign/core/Center";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { Divider } from "@astryxdesign/core/Divider";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { useOverlay } from "@astryxdesign/core/Overlay";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Text } from "@astryxdesign/core/Text";
import { MediaTheme } from "@astryxdesign/core/theme";
import { Token } from "@astryxdesign/core/Token";
import { VStack } from "@astryxdesign/core/VStack";
import { format } from "date-fns";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { useResourcePreview } from "@/hooks/use-resource-preview";
import { STATUS_LABELS } from "@/lib/resource-categories";
import { cn } from "@/lib/utils";
import type { Resource } from "@/types/library.types";

import { useResourceActions, viewerPath } from "../hooks/use-resource-actions";
import { EditResourceDialog } from "./edit-resource-dialog";

/** The shape of an Open Graph preview image. */
export const PREVIEW_RATIO = 1200 / 630;

/** Initial of the site's name: "ui.aceternity.com" → "A", "reactbits.dev" → "R". */
function siteInitial(host: string): string {
  const labels = host.split(".");
  const name = labels.length > 1 ? labels[labels.length - 2] : labels[0];
  return (name ?? host).charAt(0).toUpperCase();
}

function linkHealthLabel(resource: Resource): string | null {
  if (resource.linkHealth === "broken") return "Broken link";
  return resource.linkHealth === "moved" ? "Moved" : null;
}

/** A saved link with its preview image; opens the site inside DevAtlas. */
export function ResourceCard({ resource }: { resource: Resource }) {
  const preview = useResourcePreview(resource.url);
  const [editing, setEditing] = useState(false);
  // Reveals on hover and on focus within the card, so Tab reaches the actions after the link.
  const { containerRef, containerProps, element } = useOverlay({
    showOn: "hover",
    position: "top",
    content: (
      <ResourceActions
        resource={resource}
        onEdit={() => {
          setEditing(true);
        }}
      />
    ),
  });
  // The card's link holds no text, so its name has to carry what the card shows.
  const label = [
    resource.title,
    resource.host,
    resource.isNew ? "New" : null,
    linkHealthLabel(resource),
  ]
    .filter((part) => part !== null)
    .join(", ");

  return (
    <>
      <ClickableCard
        ref={(node) => {
          containerRef.current = node;
        }}
        {...containerProps}
        label={label}
        href={viewerPath(resource)}
        padding={0}
        height="100%"
      >
        <div title={resource.url}>
          <AspectRatio ratio={PREVIEW_RATIO}>
            <div className="relative size-full">
              {preview.isPending ? (
                <Skeleton radius="none" />
              ) : (
                <RemoteImage
                  src={preview.data?.image ?? null}
                  className="size-full object-cover"
                  fallback={
                    <Center height="100%">
                      <SiteIcon
                        icon={preview.data?.icon ?? null}
                        host={resource.host}
                        className="size-14 rounded-2xl text-xl"
                      />
                    </Center>
                  }
                />
              )}
              <HStack gap={1} className="absolute bottom-2 left-2">
                <ResourceBadges resource={resource} />
              </HStack>
            </div>
          </AspectRatio>
          <Divider />
          <HStack gap={3} padding={3} vAlign="start">
            <SiteIcon
              icon={preview.data?.icon ?? null}
              host={resource.host}
              className="size-9 rounded-lg text-sm"
            />
            <VStack gap={1} className="min-w-0 flex-1">
              <Heading level={5} accessibilityLevel={3} maxLines={2}>
                {resource.title}
              </Heading>
              <HStack gap={3} vAlign="center" hAlign="between">
                <div className="min-w-0">
                  <Text type="code" size="xsm" color="secondary" maxLines={1}>
                    {resource.host}
                  </Text>
                </div>
                {resource.addedAt !== null && (
                  <div className="shrink-0">
                    <Text type="supporting">
                      {resource.origin === "devatlas" ? "Added" : "Saved"}{" "}
                      {format(resource.addedAt, "MMM yyyy")}
                    </Text>
                  </div>
                )}
              </HStack>
              {(resource.tags.length > 0 || resource.status !== null) && (
                <ResourceTags tags={resource.tags} status={resource.status} className="mt-1" />
              )}
            </VStack>
          </HStack>
        </div>
        {element}
      </ClickableCard>
      {/* Outside the card: a click inside the dialog must not reach the card's link. */}
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

/** A link's New and link-health marks. */
export function ResourceBadges({ resource }: { resource: Resource }) {
  const health = linkHealthLabel(resource);
  return (
    <>
      {resource.isNew && <Badge variant="info" label="New" />}
      {health !== null && (
        <Badge variant={resource.linkHealth === "broken" ? "error" : "warning"} label={health} />
      )}
    </>
  );
}

/** Edit, remove (with undo) and open-in-browser, shared by the card and list views. */
export function ResourceActions({ resource, onEdit }: { resource: Resource; onEdit: () => void }) {
  const { openExternally, remove } = useResourceActions(resource);
  return (
    <HStack gap={1}>
      <IconButton
        variant="ghost"
        size="sm"
        icon={<Icon icon={Pencil} />}
        label={`Edit ${resource.title}`}
        tooltip="Edit category, tags and notes"
        onClick={onEdit}
      />
      <IconButton
        variant="ghost"
        size="sm"
        icon={<Icon icon={Trash2} />}
        label={`Remove ${resource.title} from your library`}
        tooltip="Remove from library"
        onClick={remove}
      />
      <IconButton
        variant="ghost"
        size="sm"
        icon={<Icon icon={ExternalLink} />}
        label={`Open ${resource.host} in your browser`}
        tooltip="Open in your browser"
        onClick={openExternally}
      />
    </HStack>
  );
}

/** A link's reading status and tags, as small tokens. */
export function ResourceTags({
  tags,
  status = null,
  className,
}: {
  tags: readonly string[];
  status?: Resource["status"];
  className?: string;
}) {
  return (
    <HStack gap={1} wrap="wrap" className={className}>
      {status !== null && <Token size="sm" color="blue" label={STATUS_LABELS[status]} />}
      {tags.map((tag) => (
        <Token key={tag} size="sm" label={tag} />
      ))}
    </HStack>
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
        "flex shrink-0 items-center justify-center overflow-hidden border border-(--color-border) bg-(--color-background-muted) text-(--color-text-secondary)",
        className,
      )}
    >
      {/* Always a light backing: many favicons are dark marks on transparency. */}
      <MediaTheme mode="light">
        <RemoteImage
          src={icon}
          className="size-full bg-(--color-background-card) object-contain p-1.5"
          fallback={
            <Text type="inherit" color="inherit" weight="semibold">
              {siteInitial(host)}
            </Text>
          }
        />
      </MediaTheme>
    </span>
  );
}
