import { useSearchParams } from "react-router";

import { ForYouToggle } from "@/components/shared/for-you-toggle";
import { PageHeader } from "@/components/shared/page-header";
import { SearchField } from "@/components/shared/search-field";
import { useInterests } from "@/hooks/use-interests";
import { interestMatcher } from "@/lib/interests";

import { NewsView } from "./news-view";

/** News: what developers are discussing, and the latest posts from official language,
 * framework, database and tool blogs. Search lives in `?q=`. */
export function NewsPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";
  const interests = useInterests();
  const forYou = params.get("for") === "me" && interests.length > 0;

  return (
    <div className="w-full px-5 pt-5 pb-16 lg:px-8">
      <PageHeader
        title="News"
        description="What developers are talking about, and the latest from official blogs."
      >
        <div className="flex max-w-md min-w-0 flex-1 basis-80 items-center gap-2">
          <ForYouToggle
            active={forYou}
            disabled={interests.length === 0}
            onToggle={() => {
              setParams(
                (current) => {
                  const next = new URLSearchParams(current);
                  if (forYou) next.delete("for");
                  else next.set("for", "me");
                  return next;
                },
                { replace: true },
              );
            }}
          />
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

      <NewsView search={search} matches={forYou ? interestMatcher(interests) : undefined} />
    </div>
  );
}
