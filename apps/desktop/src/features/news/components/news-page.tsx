import { Newspaper } from "lucide-react";
import { useSearchParams } from "react-router";

import { SearchField } from "@/components/shared/search-field";

import { NewsView } from "./news-view";

/** News: what developers are discussing, and the latest posts from official language,
 * framework, database and tool blogs. Search lives in `?q=`. */
export function NewsPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";

  return (
    <div className="w-full px-5 pt-6 pb-16 lg:px-8">
      <div className="flex min-w-0 items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-card">
          <Newspaper className="size-6 text-primary" aria-hidden />
        </span>
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.025em]">News</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            What developers are talking about, and the latest posts from official language,
            framework, database and tool blogs.
          </p>
        </div>
      </div>

      <div className="mt-5 flex">
        <SearchField
          value={search}
          onChange={(value) => {
            setParams(
              (current) => {
                const next = new URLSearchParams(current);
                if (value === "") next.delete("q");
                else next.set("q", value);
                return next;
              },
              { replace: true },
            );
          }}
          label="Search blog posts"
          placeholder="Search blog posts or sources…"
        />
      </div>

      <NewsView search={search} />
    </div>
  );
}
