import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Link as AstryxLink } from "@astryxdesign/core/Link";
import { List, ListItem } from "@astryxdesign/core/List";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Text } from "@astryxdesign/core/Text";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import { VStack } from "@astryxdesign/core/VStack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  GitFork,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { useId, useRef, useState, type ReactNode, type Ref } from "react";
import { toast } from "sonner";

import { useResourceActions } from "@/features/library";
import { FeedError, InAppAnchor } from "@/features/news";
import { libraryQueryKey } from "@/hooks/use-library";
import { cn } from "@/lib/utils";
import { describeError } from "@/services/ipc";
import { addLink } from "@/services/library.service";
import type { GithubRepo } from "@/types/discovery.types";
import type { Resource } from "@/types/library.types";

import { compactNumber, languageColor, openExternal, repoViewerPath } from "../repo-utils";

/** GitHub's mark (Octicons `mark-github`, MIT); Lucide no longer ships brand icons. */
export function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden fill="currentColor" className={className}>
      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
    </svg>
  );
}

/** Owner avatar; falls back to github.com/<owner>.png when GitHub's details are missing.
 * A plain image because Astryx's Avatar can't set `referrerPolicy`. */
export function RepoAvatar({
  fullName,
  details,
  className,
}: {
  fullName: string;
  details: GithubRepo | undefined;
  className?: string;
}) {
  const owner = fullName.split("/")[0] ?? fullName;
  const src = details?.ownerAvatar ?? `https://github.com/${encodeURIComponent(owner)}.png?size=96`;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      className={cn("shrink-0 object-cover", className)}
      style={{ backgroundColor: "var(--color-background-muted)" }}
    />
  );
}

export function RepoName({ fullName, url }: { fullName: string; url: string }) {
  const [owner, name] = fullName.split("/");
  return (
    <RepoLink url={url}>
      <Text type="inherit" color="secondary" weight="normal">
        {owner} /{" "}
      </Text>
      <Text type="inherit" color="primary" weight="semibold">
        {name}
      </Text>
    </RepoLink>
  );
}

/** A GitHub link that opens inside DevAtlas; the viewer's back button returns here. */
export function RepoLink({
  url,
  className,
  title,
  children,
}: {
  url: string;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  // Astryx's Link forwards `title` to the anchor, though its props don't declare it.
  const tooltip = { title: title ?? url };
  return (
    <AstryxLink
      as={InAppAnchor}
      href={repoViewerPath(url)}
      {...tooltip}
      type="inherit"
      color="inherit"
      className={className}
    >
      {children}
    </AstryxLink>
  );
}

export function LanguagePill({ language }: { language: string }) {
  return (
    <Badge
      label={language}
      icon={
        <span
          aria-hidden
          className="block size-2 rounded-full"
          style={{ backgroundColor: languageColor(language) ?? "var(--color-text-secondary)" }}
        />
      }
    />
  );
}

function Stat({ icon, value, label }: { icon: typeof Star; value: number; label: string }) {
  return (
    <HStack gap={1.5} vAlign="center">
      <Icon icon={icon} size="xsm" color="secondary" />
      <Text type="supporting" hasTabularNumbers>
        {compactNumber.format(value)}
      </Text>
      <VisuallyHidden>{label}</VisuallyHidden>
    </HStack>
  );
}

export function CreatedAgo({ createdAt }: { createdAt: string }) {
  return (
    <HStack gap={1.5} vAlign="center">
      <Icon icon={CalendarDays} size="xsm" color="secondary" />
      <Text type="supporting">
        Created <Timestamp value={createdAt} format="relative" hasTooltip={false} />
      </Text>
    </HStack>
  );
}

/** Language, stars and forks (plus age when `inline`). `columns` lines them up across rows
 * on wide screens, where the age sits under the description instead. */
export function RepoMeta({
  details,
  layout,
  className,
}: {
  details: GithubRepo;
  layout: "columns" | "inline";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "items-center",
        layout === "columns"
          ? "grid shrink-0 grid-cols-[7.5rem_4rem_3.75rem] gap-3"
          : "flex flex-wrap gap-x-4 gap-y-1.5",
        className,
      )}
    >
      <span className="min-w-0">
        {details.language !== null && <LanguagePill language={details.language} />}
      </span>
      <Stat icon={Star} value={details.stars} label="stars" />
      <Stat icon={GitFork} value={details.forks} label="forks" />
      {layout === "inline" && <CreatedAgo createdAt={details.createdAt} />}
    </div>
  );
}

/** Star growth from star-history.com: an SVG loaded as an image (it cannot run scripts),
 * requested only when shown. The lowercase name is star-history's canonical form. */
export function StarHistory({ fullName }: { fullName: string }) {
  const [failed, setFailed] = useState(false);
  const chart = `https://api.star-history.com/svg?repos=${encodeURIComponent(fullName.toLowerCase())}&type=Date&theme=dark`;
  const page = `https://www.star-history.com/?repos=${encodeURIComponent(fullName)}&type=date&legend=top-left`;

  return (
    <VStack gap={2} maxWidth={640}>
      {failed ? (
        <Text type="supporting" as="p">
          The star history chart couldn&apos;t be loaded right now.
        </Text>
      ) : (
        <img
          src={chart}
          alt={`Star history chart for ${fullName}: stars over time`}
          width={800}
          height={533}
          referrerPolicy="no-referrer"
          onError={() => {
            setFailed(true);
          }}
          className="aspect-[3/2] h-auto w-full rounded-lg"
        />
      )}
      <Text type="supporting">
        <AstryxLink
          href={page}
          type="inherit"
          onClick={(event) => {
            event.preventDefault();
            openExternal(page, "star-history.com");
          }}
        >
          Compare on star-history.com <Icon icon={ExternalLink} size="xsm" />
        </AstryxLink>
      </Text>
    </VStack>
  );
}

export function OpenOnGithubButton({ fullName, url }: { fullName: string; url: string }) {
  return (
    <IconButton
      as={InAppAnchor}
      href={repoViewerPath(url)}
      variant="ghost"
      label={`Open ${fullName} on GitHub`}
      tooltip="Open on GitHub"
      icon={<Icon icon={ExternalLink} />}
    />
  );
}

/** Saves a repository to the library; shows "Saved" once it is there. */
export function SaveRepoButton({
  repo,
  saved,
  compact = false,
}: {
  repo: Pick<GithubRepo, "fullName" | "url">;
  saved: boolean;
  compact?: boolean;
}) {
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: () => addLink(repo.url),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: libraryQueryKey });
      toast.success(`Saved ${repo.fullName} to your library`);
    },
    onError: (error) => {
      toast.error(`Couldn't save ${repo.fullName}`, {
        description: describeError(error).replace(/^.*?failed: /, ""),
      });
    },
  });
  const isSaved = saved || save.isSuccess;
  const label = isSaved
    ? `${repo.fullName} is in your library`
    : `Save ${repo.fullName} to your library`;

  return (
    <Button
      label={label}
      size="sm"
      variant={isSaved ? "ghost" : "secondary"}
      isDisabled={isSaved}
      isLoading={save.isPending}
      isIconOnly={compact}
      // Fixed width, so the row's columns stay put when "Save" becomes "Saved".
      width={compact ? undefined : 92}
      tooltip={compact ? label : undefined}
      icon={<Icon icon={isSaved ? Check : Plus} />}
      onClick={() => {
        save.mutate();
      }}
    >
      {compact ? undefined : isSaved ? "Saved" : save.isPending ? "Saving" : "Save"}
    </Button>
  );
}

/** Removes a saved repository from the library (Brave bookmarks are hidden, not deleted). */
export function RemoveRepoButton({ resource, fullName }: { resource: Resource; fullName: string }) {
  const { remove } = useResourceActions(resource);
  return (
    <IconButton
      variant="ghost"
      label={`Remove ${fullName} from your library`}
      tooltip="Remove from library"
      icon={<Icon icon={Trash2} />}
      onClick={remove}
    />
  );
}

/** The keyboard and screen-reader control for a repository's details. */
export function ExpandRepoButton({
  fullName,
  expanded,
  detailsId,
  onToggle,
  ref,
}: {
  fullName: string;
  expanded: boolean;
  detailsId: string;
  onToggle: () => void;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <IconButton
      ref={ref}
      variant="ghost"
      label={`${expanded ? "Hide" : "Show"} details for ${fullName}`}
      icon={<Icon icon={expanded ? ChevronUp : ChevronDown} />}
      aria-expanded={expanded}
      aria-controls={detailsId}
      onClick={onToggle}
    />
  );
}

/** A repository's dates, counts and star history, shown when its row is expanded. */
export function RepoDetails({
  id,
  fullName,
  details,
}: {
  id: string;
  fullName: string;
  details: GithubRepo | undefined;
}) {
  return (
    <VStack id={id} gap={3}>
      {details !== undefined && (
        <Text type="supporting" as="p">
          Created {format(new Date(details.createdAt), "MMMM d, yyyy")} ·{" "}
          {details.stars.toLocaleString("en")} stars · {details.forks.toLocaleString("en")} forks
        </Text>
      )}
      <StarHistory fullName={fullName} />
    </VStack>
  );
}

interface RepoRowProps {
  fullName: string;
  url: string;
  details: GithubRepo | undefined;
  /** Shown in place of the description while details load or when they are unavailable. */
  note?: string;
  rank?: number;
  /** Shown beside the rank, such as movement since last week. */
  marker?: ReactNode;
  /** Shown before the actions when there are no GitHub details, such as star counts. */
  metric?: ReactNode;
  /** Shown under the description, such as the latest release. */
  activity?: ReactNode;
  /** The row's main action, such as Save or Remove. */
  action: ReactNode;
}

/** A repository as a `List` row: click it (or the chevron) to expand its star history and
 * links, and again to collapse. Clicks on links and buttons inside keep their own meaning. */
export function RepoRow({
  fullName,
  url,
  details,
  note,
  rank,
  marker,
  metric,
  activity,
  action,
}: RepoRowProps) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const expandButton = useRef<HTMLButtonElement>(null);
  const description = details?.description ?? note;

  return (
    <ListItem
      align="start"
      // Clicks on the row go to the chevron, so the row itself adds no tab stop.
      interactiveRef={expandButton}
      startContent={
        <HStack gap={3} vAlign="center">
          {rank !== undefined && (
            <span className="w-6 text-right">
              <Text color="secondary" hasTabularNumbers>
                {rank}
              </Text>
            </span>
          )}
          {marker}
          <RepoAvatar fullName={fullName} details={details} className="size-10 rounded-lg" />
        </HStack>
      }
      label={
        <HStack gap={3} vAlign="center">
          <div className="min-w-0">
            <Heading level={4} accessibilityLevel={3} maxLines={1}>
              <RepoName fullName={fullName} url={url} />
            </Heading>
          </div>
          {details !== undefined && (
            <span className="hidden shrink-0 xl:inline">
              <CreatedAgo createdAt={details.createdAt} />
            </span>
          )}
        </HStack>
      }
      description={
        <VStack gap={1.5}>
          {description !== undefined && (
            <Text as="p" color="secondary" maxLines={expanded ? 0 : 1}>
              {description}
            </Text>
          )}
          {activity}
          {details !== undefined && (
            <RepoMeta details={details} layout="inline" className="xl:hidden" />
          )}
          {expanded && (
            // Selecting or clicking inside the details shouldn't collapse them.
            <div
              className="pt-2"
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              <RepoDetails id={detailsId} fullName={fullName} details={details} />
            </div>
          )}
        </VStack>
      }
      endContent={
        <HStack gap={3} vAlign="center">
          {details !== undefined && (
            <RepoMeta details={details} layout="columns" className="hidden xl:grid" />
          )}
          {metric}
          <HStack gap={1} vAlign="center">
            {action}
            <OpenOnGithubButton fullName={fullName} url={url} />
            <ExpandRepoButton
              ref={expandButton}
              fullName={fullName}
              expanded={expanded}
              detailsId={detailsId}
              onToggle={() => {
                setExpanded((open) => !open);
              }}
            />
          </HStack>
        </HStack>
      }
    />
  );
}

export function RepoListSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true">
      <VisuallyHidden>{label}</VisuallyHidden>
      <List hasDividers>
        {Array.from({ length: 6 }, (_, index) => (
          <ListItem
            key={index}
            startContent={<Skeleton width={40} height={40} index={index} />}
            label={<Skeleton width={224} height={16} index={index} />}
            description={<Skeleton width="66%" height={14} index={index} />}
          />
        ))}
      </List>
    </div>
  );
}

/** A list that failed to load: what happened, and a retry. */
export const RepoListError = FeedError;

/** A saved repository as a card, for the grid view. */
export function RepoCard({
  fullName,
  url,
  details,
  note,
  savedAt,
  activity,
  action,
}: Omit<RepoRowProps, "rank"> & { savedAt: number | null }) {
  const description = details?.description ?? note;
  return (
    <Card height="100%">
      <VStack gap={3} height="100%">
        <HStack gap={3} vAlign="start">
          <RepoAvatar fullName={fullName} details={details} className="size-11 rounded-lg" />
          <div className="min-w-0 flex-1">
            <Heading level={4} accessibilityLevel={3} maxLines={1}>
              <RepoName fullName={fullName} url={url} />
            </Heading>
            {savedAt !== null && (
              <Text type="supporting" as="p">
                Saved <Timestamp value={savedAt} format="date" />
              </Text>
            )}
          </div>
          <HStack gap={1} vAlign="center">
            {action}
            <OpenOnGithubButton fullName={fullName} url={url} />
          </HStack>
        </HStack>
        <div className="flex-1">
          <Text as="p" color="secondary" maxLines={3}>
            {description ?? "No description."}
          </Text>
        </div>
        {activity}
        {details !== undefined && <RepoMeta details={details} layout="inline" />}
      </VStack>
    </Card>
  );
}
