import { Trophy } from "lucide-react";

import { LanguageRankings } from "./news-top";

/** Rankings: how popular programming languages are, from the indexes that update monthly. */
export function RankingsPage() {
  return (
    <div className="w-full px-5 pt-6 pb-16 lg:px-8">
      <div className="flex min-w-0 items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-card">
          <Trophy className="size-6 text-primary" aria-hidden />
        </span>
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.025em]">Language rankings</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            How popular programming languages are, from the two indexes that update every month,
            with each language&apos;s movement over the last year.
          </p>
        </div>
      </div>
      <div className="mt-6">
        <LanguageRankings />
      </div>
    </div>
  );
}
