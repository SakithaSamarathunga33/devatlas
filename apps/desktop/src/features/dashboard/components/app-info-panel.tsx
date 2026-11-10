import { format } from "date-fns";
import {
  AppWindow,
  CircleAlert,
  Cpu,
  Monitor,
  RotateCw,
  Tag,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { IconTile } from "@/components/shared/icon-tile";
import { ShineButton } from "@/components/shared/shine-button";
import { StatusBeacon } from "@/components/shared/status-beacon";
import Loader from "@/components/kokonutui/loader";
import { BorderBeam } from "@/components/ui/border-beam";
import { MagicCard } from "@/components/ui/magic-card";
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
    <MagicCard className="h-full">
      {/* The beam runs only while the backend link is live. */}
      {query.isSuccess && (
        <BorderBeam size={110} duration={9} colorFrom="#8b6cff" colorTo="#3aa0ff" />
      )}
      <section aria-labelledby="app-info-heading" className="flex h-full flex-col p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <IconTile icon={Cpu} />
            <div>
              <h2 id="app-info-heading" className="text-sm font-semibold">
                This installation
              </h2>
              <p className="text-xs text-muted-foreground">Reported live by the Rust backend</p>
            </div>
          </div>
          {query.isSuccess && (
            <span className="text-xs text-muted-foreground tabular-nums">
              Checked at {format(query.dataUpdatedAt, "HH:mm:ss")}
            </span>
          )}
        </div>

        <div className="mt-5 flex-1">
          {query.isPending && (
            <Loader size="sm" title="Connecting to the Rust backend" subtitle="" className="p-4" />
          )}
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
    </MagicCard>
  );
}

function AppInfoDetails({ info }: { info: AppInfo }) {
  return (
    <dl className="grid grid-cols-2 gap-3">
      <InfoTile icon={AppWindow} term="Application">
        {info.name}
      </InfoTile>
      <InfoTile icon={Tag} term="Version">
        <span className="font-mono">{info.version}</span>
      </InfoTile>
      <InfoTile icon={Monitor} term="Operating system">
        {formatPlatform(info.platform)}
      </InfoTile>
      <InfoTile icon={Zap} term="Backend">
        <span className="inline-flex items-center gap-2">
          <StatusBeacon tone="success" pulse={false} />
          Connected
        </span>
      </InfoTile>
    </dl>
  );
}

interface InfoTileProps {
  icon: LucideIcon;
  term: string;
  children: ReactNode;
}

function InfoTile({ icon: Icon, term, children }: InfoTileProps) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 transition-colors hover:bg-white/[0.04]">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        {term}
      </dt>
      <dd className="mt-1.5 text-sm font-medium">{children}</dd>
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
    <div role="alert" className="flex flex-col items-start gap-3">
      <p className="flex items-center gap-2 text-sm font-medium text-destructive">
        <CircleAlert className="size-4" aria-hidden />
        Backend unavailable
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground">{message}</p>
      <ShineButton onClick={onRetry} disabled={retrying} className="mt-1">
        <RotateCw
          className={cn(retrying && "animate-spin motion-reduce:animate-none")}
          aria-hidden
        />
        {retrying ? "Retrying" : "Try again"}
      </ShineButton>
    </div>
  );
}
