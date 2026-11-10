import { StatusBeacon, type BeaconTone } from "@/components/shared/status-beacon";
import { useAppInfo } from "@/hooks/use-app-info";
import { cn } from "@/lib/utils";

const STATUS: Record<"pending" | "success" | "error", { label: string; tone: BeaconTone }> = {
  pending: { label: "Connecting to backend", tone: "warning" },
  success: { label: "Backend connected", tone: "success" },
  error: { label: "Backend unavailable", tone: "destructive" },
};

/** Live indicator of the Rust backend connection, derived from the app-info query. */
export function BackendStatus({ className }: { className?: string }) {
  const { status } = useAppInfo();
  const { label, tone } = STATUS[status];

  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-muted-foreground backdrop-blur",
        className,
      )}
    >
      <StatusBeacon tone={tone} pulse={status !== "error"} />
      {label}
    </span>
  );
}
