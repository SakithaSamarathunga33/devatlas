import { useSearchParams } from "react-router";

import { PageHeader } from "@/components/shared/page-header";
import { SearchField } from "@/components/shared/search-field";

import { NewsView } from "./news-view";

/** News: what developers are discussing, and the latest posts from official language,
 * framework, database and tool blogs. Search lives in `?q=`. */
export function NewsPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";

  return (
    <div className="w-full px-5 pt-5 pb-16 lg:px-8">
      <PageHeader
        title="News"
        description="What developers are talking about, and the latest from official blogs."
      >
        <div className="flex max-w-sm min-w-0 flex-1 basis-80">
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
            placeholder="Search posts or sources…"
          />
        </div>
      </PageHeader>

      <NewsView search={search} />
    </div>
  );
}
