import { VStack } from "@astryxdesign/core/VStack";
import { PageHeader } from "@/components/shared/page-header";

import { LanguageRankings } from "./news-top";

/** Rankings: how popular programming languages are, from the indexes that update monthly. */
export function RankingsPage() {
  return (
    <VStack padding={6}>
      <PageHeader
        title="Languages"
        description="How popular languages are this month, and how each has moved over the last year."
      />
      <div className="mt-4">
        <LanguageRankings />
      </div>
    </VStack>
  );
}
