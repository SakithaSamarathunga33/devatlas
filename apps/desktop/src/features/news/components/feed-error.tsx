import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { RotateCw } from "lucide-react";

/** A feed that failed to load: what happened, and a retry. */
export function FeedError({
  title,
  query,
}: {
  title: string;
  query: { error: Error; isFetching: boolean; refetch: () => Promise<unknown> };
}) {
  return (
    // The alert wraps the Banner so the retry is announced with the message.
    <div role="alert">
      <Banner
        status="error"
        title={title}
        description={query.error.message.replace(/^.*?failed: /, "")}
        endContent={
          <Button
            label="Try again"
            size="sm"
            icon={<Icon icon={RotateCw} />}
            isLoading={query.isFetching}
            onClick={() => void query.refetch()}
          />
        }
      />
    </div>
  );
}
