import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  ExternalLink,
  GitFork,
  LoaderCircle,
  Plus,
  RotateCw,
  Star,
  Trash2,
} from "lucide-react";
import { useId, useState, type MouseEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useResourceActions } from "@/features/library";
import { libraryQueryKey } from "@/hooks/use-library";
import { cn } from "@/lib/utils";
import { describeError } from "@/services/ipc";
import { addLink } from "@/services/library.service";
import type { GithubRepo } from "@/types/discovery.types";
import type { Resource } from "@/types/library.types";

import { compactNumber, languageColor, openExternal } from "../repo-utils";

/** The panel that holds `RepoRow`s: one card with hairlines, like the dashboard's lists. */
export const REPO_LIST =
  "divide-y divide-border overflow-hidden rounded-xl border border-border bg-card";

/** GitHub's mark (Octicons `mark-github`, MIT); Lucide no longer ships brand icons. */
export function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden fill="currentColor" className={className}>
      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
    </svg>
  );
}

/** Owner avatar; falls back to github.com/<owner>.png when GitHub's details are missing. */
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
      className={cn("shrink-0 bg-secondary object-cover", className)}
    />
  );
}

export function RepoName({ fullName, url }: { fullName: string; url: string }) {
  const [owner, name] = fullName.split("/");
  return (
    <a
      href={url}
      onClick={(event) => {
        // The app webview must never navigate away; GitHub opens in the system browser.
        event.preventDefault();
        openExternal(url, fullName);
      }}
      className="rounded outline-none hover:underline hover:underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="text-muted-foreground">{owner} / </span>
      <span className="font-semibold">{name}</span>
    </a>
  );
}

export function LanguagePill({ language }: { language: string }) {
  const color = languageColor(language);
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-border bg-secondary px-2 py-0.5 text-xs">
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full bg-muted-foreground opacity-70"
        style={color === undefined ? undefined : { backgroundColor: color }}
      />
      <span className="truncate">{language}</span>
    </span>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof Star; value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-3.5" aria-hidden />
      <span className="tabular-nums">{compactNumber.format(value)}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function CreatedAgo({ createdAt }: { createdAt: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <CalendarDays className="size-3.5" aria-hidden />
      Created {formatDistanceToNowStrict(new Date(createdAt), { addSuffix: true })}
    </span>
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
        "items-center text-xs text-muted-foreground",
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
    <div className="max-w-[640px]">
      {failed ? (
        <p className="text-sm text-muted-foreground">
          The star history chart couldn&apos;t be loaded right now.
        </p>
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
          className="aspect-[3/2] h-auto w-full rounded-lg border border-border bg-card"
        />
      )}
      <a
        href={page}
        onClick={(event) => {
          event.preventDefault();
          openExternal(page, "star-history.com");
        }}
        className="mt-2 inline-flex items-center gap-1 rounded text-xs text-primary outline-none hover:underline hover:underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring"
      >
        Compare on star-history.com
        <ExternalLink className="size-3" aria-hidden />
      </a>
    </div>
  );
}

export function OpenOnGithubButton({ fullName, url }: { fullName: string; url: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Open ${fullName} on GitHub`}
      title="Open on GitHub"
      onClick={() => {
        openExternal(url, fullName);
      }}
      className="size-9 text-muted-foreground"
    >
      <ExternalLink aria-hidden />
    </Button>
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
      size={compact ? "icon-sm" : "sm"}
      disabled={isSaved || save.isPending}
      onClick={() => {
        save.mutate();
      }}
      aria-label={label}
      title={compact ? label : undefined}
      className={cn(
        "border",
        // Fixed width, so the row's columns stay put when "Save" becomes "Saved".
        !compact && "h-9 w-[5.75rem] px-3",
        isSaved
          ? "border-transparent bg-transparent text-muted-foreground disabled:opacity-100"
          : "border-border bg-transparent text-primary hover:border-primary/40 hover:bg-primary/15",
      )}
    >
      {isSaved ? (
        <Check aria-hidden />
      ) : save.isPending ? (
        <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden />
      ) : (
        <Plus aria-hidden />
      )}
      {!compact && (isSaved ? "Saved" : save.isPending ? "Saving" : "Save")}
    </Button>
  );
}

/** Removes a saved repository from the library (Brave bookmarks are hidden, not deleted). */
export function RemoveRepoButton({ resource, fullName }: { resource: Resource; fullName: string }) {
  const { remove } = useResourceActions(resource);
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Remove ${fullName} from your library`}
      title="Remove from library"
      onClick={remove}
      className="size-9 text-muted-foreground hover:text-destructive"
    >
      <Trash2 aria-hidden />
    </Button>
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

/** A repository as a row: click it (or the chevron) to expand its star history and links,
 * and again to collapse. Clicks on links and buttons inside keep their own meaning. */
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
  const toggle = () => {
    setExpanded((open) => !open);
  };
  // Mouse convenience: clicking anywhere on the row toggles it. The chevron button is the
  // keyboard and screen-reader path, so the row itself is not a focusable control.
  const onRowClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest("a, button, input, select")) {
      return;
    }
    toggle();
  };
  const description = details?.description ?? note;

  return (
    <article className={cn("transition-colors", expanded && "bg-secondary/40")}>
      <div
        onClick={onRowClick}
        className="flex cursor-pointer items-center gap-4 px-3 py-2.5 transition-colors hover:bg-secondary/40"
      >
        {rank !== undefined && (
          <span className="w-6 shrink-0 text-right text-sm text-muted-foreground tabular-nums">
            {rank}
          </span>
        )}
        {marker}
        <RepoAvatar fullName={fullName} details={details} className="size-10 rounded-lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3">
            <h3 className="min-w-0 truncate text-sm">
              <RepoName fullName={fullName} url={url} />
            </h3>
            {details !== undefined && (
              <span className="hidden shrink-0 text-xs text-muted-foreground xl:inline">
                <CreatedAgo createdAt={details.createdAt} />
              </span>
            )}
          </div>
          {description !== undefined && (
            <p
              className={cn(
                "mt-0.5 max-w-[75ch] text-sm text-muted-foreground",
                !expanded && "line-clamp-1",
              )}
            >
              {description}
            </p>
          )}
          {activity}
          {details !== undefined && (
            <RepoMeta details={details} layout="inline" className="mt-2 xl:hidden" />
          )}
        </div>
        {details !== undefined && (
          <RepoMeta details={details} layout="columns" className="hidden xl:grid" />
        )}
        {metric}
        <div className="flex shrink-0 items-center gap-2">
          {action}
          <OpenOnGithubButton fullName={fullName} url={url} />
          <Button
            variant="ghost"
            size="icon"
            aria-expanded={expanded}
            aria-controls={detailsId}
            aria-label={`${expanded ? "Hide" : "Show"} details for ${fullName}`}
            onClick={toggle}
            className="size-9 text-muted-foreground"
          >
            <ChevronDown
              aria-hidden
              className={cn(
                "transition-transform duration-200 motion-reduce:transition-none",
                expanded && "rotate-180",
              )}
            />
          </Button>
        </div>
      </div>
      {expanded && (
        <div id={detailsId} className="border-t border-border px-4 pt-4 pb-4 sm:pl-[6.75rem]">
          {details !== undefined && (
            <p className="mb-3 text-xs text-muted-foreground">
              Created {format(new Date(details.createdAt), "MMMM d, yyyy")} ·{" "}
              {details.stars.toLocaleString("en")} stars · {details.forks.toLocaleString("en")}{" "}
              forks
            </p>
          )}
          <StarHistory fullName={fullName} />
        </div>
      )}
    </article>
  );
}

export function RepoListSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" className={cn("mt-4", REPO_LIST)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex items-center gap-4 px-3 py-2.5">
          <Skeleton className="size-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A list that failed to load: what happened, and a retry. */
export function RepoListError({
  title,
  query,
}: {
  title: string;
  query: { error: Error; isFetching: boolean; refetch: () => Promise<unknown> };
}) {
  return (
    <div role="alert" className="mt-8 flex flex-col items-start gap-3">
      <p className="flex items-center gap-2 text-sm font-medium text-destructive">
        <CircleAlert className="size-4" aria-hidden />
        {title}
      </p>
      <p className="text-sm text-muted-foreground">
        {query.error.message.replace(/^.*?failed: /, "")}
      </p>
      <Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>
        <RotateCw aria-hidden />
        Try again
      </Button>
    </div>
  );
}

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
    <article className="flex h-full flex-col rounded-xl border border-border bg-card p-4 transition-[border-color] duration-150 hover:border-foreground/15">
      <div className="flex items-start gap-3">
        <RepoAvatar fullName={fullName} details={details} className="size-11 rounded-lg" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm">
            <RepoName fullName={fullName} url={url} />
          </h3>
          {savedAt !== null && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Saved {format(savedAt, "MMM d, yyyy")}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          <OpenOnGithubButton fullName={fullName} url={url} />
        </div>
      </div>
      <p className="mt-3 line-clamp-3 flex-1 text-sm text-muted-foreground">
        {description ?? "No description."}
      </p>
      {activity}
      {details !== undefined && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {details.language !== null && <LanguagePill language={details.language} />}
          <Stat icon={Star} value={details.stars} label="stars" />
          <Stat icon={GitFork} value={details.forks} label="forks" />
          <CreatedAgo createdAt={details.createdAt} />
        </div>
      )}
    </article>
  );
}
