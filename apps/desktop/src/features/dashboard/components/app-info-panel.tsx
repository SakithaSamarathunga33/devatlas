import { format } from "date-fns";
import { CircleAlert, RotateCw } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppInfo } from "@/hooks/use-app-info";
import { formatPlatform } from "@/lib/platform";
import { cn } from "@/lib/utils";
import type { AppInfo } from "@/types/app-info.types";

/** Identity of this installation, as reported by the Rust backend. */
export function AppInfoPanel() {
  const query = useAppInfo();

  async function retry() {
    const result = await query.refetch();
    if (result.isSuccess) toast.success("Backend connected");
  }

  return (
    <section aria-labelledby="app-info-heading" className="rounded-xl border border-border bg-card">
      <div className="flex h-12 items-center justify-between gap-4 border-b border-border px-5">
        <h2 id="app-info-heading" className="text-sm font-medium">
          This installation
        </h2>
        {query.isSuccess && (
          <span className="text-xs text-muted-foreground tabular-nums">
            Checked at {format(query.dataUpdatedAt, "HH:mm:ss")}
          </span>
        )}
      </div>
      <div className="px-5 py-1.5">
        {query.isPending && <AppInfoSkeleton />}
        {query.isError && (
          <AppInfoError
            message={query.error.message}
            retrying={query.isFetching}
            onRetry={() => void retry()}
          />
        )}
        {query.isSuccess && <AppInfoDetails info={query.data} />}
      </div>
    </section>
  );
}

function AppInfoDetails({ info }: { info: AppInfo }) {
  return (
    <dl className="divide-y divide-border">
      <InfoRow term="Application">{info.name}</InfoRow>
      <InfoRow term="Version">
        <span className="font-mono text-[13px]">{info.version}</span>
      </InfoRow>
      <InfoRow term="Operating system">{formatPlatform(info.platform)}</InfoRow>
      <InfoRow term="Backend">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="size-1.5 rounded-full bg-success" />
          Connected
        </span>
      </InfoRow>
    </dl>
  );
}

function InfoRow({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-sm text-muted-foreground">{term}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

const SKELETON_ROWS = ["Application", "Version", "Operating system", "Backend"];

function AppInfoSkeleton() {
  return (
    <div aria-busy="true" className="divide-y divide-border">
      <span className="sr-only">Loading application information</span>
      {SKELETON_ROWS.map((term) => (
        <div key={term} className="flex items-center justify-between gap-4 py-3">
          <span className="text-sm text-muted-foreground">{term}</span>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

interface AppInfoErrorProps {
  message: string;
  retrying: boolean;
  onRetry: () => void;
}

function AppInfoError({ message, retrying, onRetry }: AppInfoErrorProps) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 py-4">
      <p className="flex items-center gap-2 text-sm font-medium text-destructive">
        <CircleAlert className="size-4" aria-hidden />
        Backend unavailable
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
        <RotateCw
          className={cn(retrying && "animate-spin motion-reduce:animate-none")}
          aria-hidden
        />
        {retrying ? "Retrying" : "Try again"}
      </Button>
    </div>
  );
}
