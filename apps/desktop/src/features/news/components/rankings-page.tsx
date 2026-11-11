import { PageHeader } from "@/components/shared/page-header";

import { LanguageRankings } from "./news-top";

/** Rankings: how popular programming languages are, from the indexes that update monthly. */
export function RankingsPage() {
  return (
    <div className="w-full px-5 pt-5 pb-16 lg:px-8">
      <PageHeader
        title="Language rankings"
        description="How popular languages are this month, and how each has moved over the last year."
      />
      <div className="mt-4">
        <LanguageRankings />
      </div>
    </div>
  );
}
