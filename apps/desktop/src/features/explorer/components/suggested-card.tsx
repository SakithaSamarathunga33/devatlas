import { Badge } from "@astryxdesign/core/Badge";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { LinkProvider } from "@astryxdesign/core/Link";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { X } from "lucide-react";
import type { ComponentProps } from "react";
import { Link, useLocation } from "react-router";

import { RemoteImage, SiteIcon } from "@/features/library";
import { useResourcePreview } from "@/hooks/use-resource-preview";

import type { SuggestedLink } from "../suggested-links";

/** Routes the card in-app and tells the viewer where its back button should return. */
function ViewerLink({
  href,
  ...props
}: Omit<ComponentProps<typeof Link>, "to"> & { href: string }) {
  const location = useLocation();
  return <Link to={href} state={{ from: `${location.pathname}${location.search}` }} {...props} />;
}

/** A link DevAtlas suggests; opens inside the app and can be removed. */
export function SuggestedCard({
  link,
  onRemove,
}: {
  link: SuggestedLink;
  onRemove: (link: SuggestedLink) => void;
}) {
  const preview = useResourcePreview(link.url);
  const host = new URL(link.url).hostname.replace(/^www\./, "");

  return (
    <LinkProvider component={ViewerLink}>
      <ClickableCard
        href={`/explorer/view?url=${encodeURIComponent(link.url)}`}
        label={`${link.title}, ${host}: ${link.description}`}
        padding={0}
        height="100%"
      >
        <div title={link.url} className="aspect-[1200/630] overflow-hidden">
          {preview.isPending ? (
            <Skeleton radius="none" />
          ) : (
            <RemoteImage
              src={preview.data?.image ?? null}
              className="size-full object-cover"
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
        </div>
        <HStack gap={3} padding={3} vAlign="start">
          <SiteIcon
            icon={preview.data?.icon ?? null}
            host={host}
            className="size-9 rounded-lg text-sm"
          />
          <VStack gap={1} className="min-w-0 flex-1">
            <Heading level={5} accessibilityLevel={3} maxLines={2}>
              {link.title}
            </Heading>
            <HStack gap={2} vAlign="center">
              <Text type="supporting" maxLines={1}>
                {host}
              </Text>
              <Badge label="Suggested" />
            </HStack>
            <Text type="supporting" as="p">
              {link.description}
            </Text>
          </VStack>
          <IconButton
            variant="ghost"
            size="sm"
            label={`Remove ${link.title}`}
            tooltip="Remove this suggestion"
            icon={<Icon icon={X} />}
            onClick={() => {
              onRemove(link);
            }}
          />
        </HStack>
      </ClickableCard>
    </LinkProvider>
  );
}
