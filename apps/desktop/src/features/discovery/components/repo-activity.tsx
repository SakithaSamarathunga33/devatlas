import { Badge } from "@astryxdesign/core/Badge";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { useQuery } from "@tanstack/react-query";
import { differenceInDays } from "date-fns";
import { Star, Tag } from "lucide-react";

import { getRepoActivity } from "@/services/discovery.service";

import { RepoLink } from "./repo-ui";

/** Matches the Rust-side cache for single repositories. */
const FRESH_FOR_MS = 60 * 60 * 1000;
const NEW_RELEASE_DAYS = 7;

function growth(count: number, days: number): string {
  const sign = count > 0 ? "+" : "";
  return `${sign}${count.toLocaleString("en")} stars in ${String(days)} ${days === 1 ? "day" : "days"}`;
}

/** A saved repository's newest release and recent star growth; nothing if there is neither. */
export function RepoActivityLine({ fullName }: { fullName: string }) {
  const activity = useQuery({
    queryKey: ["repo-activity", fullName.toLowerCase()],
    queryFn: () => getRepoActivity(fullName),
    staleTime: FRESH_FOR_MS,
    // GitHub allows 60 unauthenticated requests an hour; a failure just shows nothing.
    retry: false,
  });
  const release = activity.data?.latestRelease ?? null;
  const gained = activity.data?.starsGained ?? null;
  const showGrowth = gained !== null && gained.count !== 0;
  if (release === null && !showGrowth) return null;

  return (
    <HStack gap={3} vAlign="center" wrap="wrap">
      {release !== null && (
        <HStack gap={1.5} vAlign="center">
          <Icon icon={Tag} size="xsm" color="secondary" />
          <Text type="supporting" color="primary" weight="medium">
            <RepoLink url={release.url} title={release.name ?? release.tag}>
              {release.tag}
            </RepoLink>
          </Text>
          {differenceInDays(new Date(), new Date(release.publishedAt)) < NEW_RELEASE_DAYS && (
            <Badge variant="teal" label="New release" />
          )}
          <Timestamp value={release.publishedAt} format="relative" hasTooltip={false} />
        </HStack>
      )}
      {showGrowth && (
        <HStack gap={1.5} vAlign="center">
          <Icon icon={Star} size="xsm" color="secondary" />
          <Text type="supporting">{growth(gained.count, gained.days)}</Text>
        </HStack>
      )}
    </HStack>
  );
}
