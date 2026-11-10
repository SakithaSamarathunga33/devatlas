import { formatDistanceToNowStrict } from "date-fns";
import { Code, Database, Layers, SquareCode, Wrench, type LucideIcon } from "lucide-react";
import { useState } from "react";

import { GooeyFilter } from "@/components/shared/gooey-filter";
import { Skeleton } from "@/components/ui/skeleton";
import { selectClass } from "@/lib/styles";
import { cn } from "@/lib/utils";
import {
  newsCategories,
  type NewsCategory,
  type NewsItem,
  type NewsSource,
} from "@/types/news.types";

import { useNews } from "../hooks/use-news";
import { sourceIcon } from "../news-icons";
import { BrandIcon, TopStories } from "./news-top";
import { PreviewImage } from "./story-card";
import { WebLink } from "./web-link";

const CATEGORIES: Record<NewsCategory, { label: string; icon: LucideIcon }> = {
  language: { label: "Languages", icon: Code },
  framework: { label: "Frameworks", icon: Layers },
  database: { label: "Databases", icon: Database },
  tool: { label: "Tools & platforms", icon: Wrench },
};
const POSTS_PER_CARD = 3;

function ago(publishedAt: number | null): string | null {
  return publishedAt === null ? null : formatDistanceToNowStrict(publishedAt, { addSuffix: true });
}

function SourceLogo({ source, className }: { source: NewsSource; className?: string }) {
  const icon = sourceIcon(source.id);
  if (icon === undefined && source.id === "vscode") {
    return (
      <span
        aria-hidden
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-info",
          className,
        )}
      >
        <SquareCode className="size-[55%]" />
      </span>
    );
  }
  return <BrandIcon icon={icon} label={source.name} className={className} />;
}

/** What developers are discussing on top, then the latest posts from official blogs, by
 * category. */
export function NewsView({ search }: { search: string }) {
  return (
    <>
      <div className="mt-5">
        <TopStories />
      </div>
      <LatestPosts search={search} />
    </>
  );
}

function LatestPosts({ search }: { search: string }) {
  const news = useNews();
  const [category, setCategory] = useState<NewsCategory | "all">("all");
  const [sourceId, setSourceId] = useState("");

  if (news.isPending) {
    return (
      <div
        role="status"
        aria-busy="true"
        className="mt-10 grid gap-3 md:grid-cols-2 2xl:grid-cols-3"
      >
        <span className="sr-only">Loading the latest posts</span>
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-44 rounded-xl" />
        ))}
      </div>
    );
  }
  if (news.isError) {
    return (
      <p role="alert" className="mt-10 text-sm text-muted-foreground">
        {news.error.message.replace(/^.*?failed: /, "")}
      </p>
    );
  }

  const { sources, items, unavailable } = news.data;
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const term = search.trim().toLowerCase();
  const visible = items.filter((item) => {
    const source = sourceById.get(item.sourceId);
    if (source === undefined) return false;
    if (category !== "all" && source.category !== category) return false;
    if (sourceId !== "" && item.sourceId !== sourceId) return false;
    if (term === "") return true;
    return [item.title, item.summary ?? "", source.name].some((text) =>
      text.toLowerCase().includes(term),
    );
  });
  const flat = term !== "" || sourceId !== "";
  const unavailableNames = unavailable.flatMap((id) => sourceById.get(id)?.name ?? []);

  return (
    <section aria-labelledby="latest-posts-heading" className="mt-10">
      <h2 id="latest-posts-heading" className="text-base font-semibold">
        Latest from official blogs
      </h2>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <GooeyFilter
          label="Category"
          value={category}
          onChange={(value) => {
            setCategory(value);
            setSourceId("");
          }}
          options={(["all", ...newsCategories] as const).map((value) => {
            const Icon = value === "all" ? null : CATEGORIES[value].icon;
            return {
              value,
              label: value === "all" ? "All" : CATEGORIES[value].label,
              count:
                value === "all"
                  ? items.length
                  : items.filter((item) => sourceById.get(item.sourceId)?.category === value)
                      .length,
              icon: Icon === null ? undefined : <Icon aria-hidden />,
            };
          })}
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Source
          <select
            value={sourceId}
            onChange={(event) => {
              setSourceId(event.target.value);
            }}
            className={selectClass}
          >
            <option value="">All sources</option>
            {newsCategories
              .filter((value) => category === "all" || value === category)
              .map((value) => (
                <optgroup key={value} label={CATEGORIES[value].label}>
                  {sources
                    .filter((source) => source.category === value)
                    .map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.name}
                      </option>
                    ))}
                </optgroup>
              ))}
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No posts match these filters.</p>
      ) : flat ? (
        <ul
          aria-label="Matching posts"
          className="mt-4 divide-y divide-border rounded-xl border border-border bg-card"
        >
          {visible.map((item) => {
            const source = sourceById.get(item.sourceId);
            return source === undefined ? null : (
              <li key={item.url}>
                <PostRow item={item} source={source} />
              </li>
            );
          })}
        </ul>
      ) : (
        newsCategories
          .filter((value) => category === "all" || value === category)
          .map((value) => (
            <CategorySection
              key={value}
              category={value}
              sources={sources.filter((source) => source.category === value)}
              items={visible}
              onShowSource={setSourceId}
            />
          ))
      )}

      {unavailableNames.length > 0 && (
        <p className="mt-6 text-xs text-muted-foreground">
          Couldn&apos;t be read right now: {unavailableNames.join(", ")}.
        </p>
      )}
    </section>
  );
}

function CategorySection({
  category,
  sources,
  items,
  onShowSource,
}: {
  category: NewsCategory;
  sources: NewsSource[];
  items: NewsItem[];
  onShowSource: (sourceId: string) => void;
}) {
  const { label, icon: Icon } = CATEGORIES[category];
  // Sources with the most recent post first; items are already newest first.
  const withPosts = sources
    .map((source) => ({ source, posts: items.filter((item) => item.sourceId === source.id) }))
    .filter(({ posts }) => posts.length > 0)
    .sort((a, b) => (b.posts[0]?.publishedAt ?? 0) - (a.posts[0]?.publishedAt ?? 0));
  if (withPosts.length === 0) return null;

  return (
    <section aria-labelledby={`news-${category}`} className="mt-8">
      <h3 id={`news-${category}`} className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-muted-foreground" aria-hidden />
        {label}
        <span className="text-xs font-normal text-muted-foreground tabular-nums">
          {withPosts.length} sources
        </span>
      </h3>
      <ul className="mt-3 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {withPosts.map(({ source, posts }) => (
          <li key={source.id}>
            <article className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
              {posts[0] !== undefined && (
                // The latest post's preview, like library cards; decorative, the title links.
                <div
                  aria-hidden
                  className="aspect-[1200/500] overflow-hidden border-b border-border bg-linear-to-br from-primary/20 to-secondary"
                >
                  <PreviewImage url={posts[0].url} />
                </div>
              )}
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <SourceLogo source={source} className="size-9" />
                <h4 className="min-w-0 flex-1 truncate text-sm font-semibold">{source.name}</h4>
                <button
                  type="button"
                  onClick={() => {
                    onShowSource(source.id);
                  }}
                  className="rounded text-xs font-medium text-primary outline-none hover:underline hover:underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  All posts
                  <span className="sr-only"> from {source.name}</span>
                </button>
              </div>
              <ul className="flex-1 divide-y divide-border">
                {posts.slice(0, POSTS_PER_CARD).map((item) => (
                  <li key={item.url} className="px-4 py-2.5">
                    <WebLink href={item.url} className="line-clamp-2 text-sm text-foreground">
                      {item.title}
                    </WebLink>
                    {item.publishedAt !== null && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {ago(item.publishedAt)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PostRow({ item, source }: { item: NewsItem; source: NewsSource }) {
  const when = ago(item.publishedAt);
  return (
    <article className="flex items-start gap-3 px-4 py-3">
      <SourceLogo source={source} className="mt-0.5 size-9" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">
          {source.name}
          {when !== null && ` · ${when}`}
        </p>
        <h3 className="mt-0.5 text-sm font-medium">
          <WebLink href={item.url} className="text-foreground">
            {item.title}
          </WebLink>
        </h3>
        {item.summary !== null && (
          <p className="mt-1 line-clamp-2 max-w-[75ch] text-sm text-muted-foreground">
            {item.summary}
          </p>
        )}
      </div>
    </article>
  );
}
