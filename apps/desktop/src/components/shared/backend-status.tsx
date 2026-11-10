import { useAppInfo } from "@/hooks/use-app-info";
import { cn } from "@/lib/utils";

const STATUS = {
  pending: {
    label: "Connecting to backend",
    dot: "bg-warning animate-pulse motion-reduce:animate-none",
  },
  success: { label: "Backend connected", dot: "bg-success" },
  error: { label: "Backend unavailable", dot: "bg-destructive" },
} as const;

/** Live indicator of the Rust backend connection, derived from the app-info query. */
export function BackendStatus({ className }: { className?: string }) {
  const { status } = useAppInfo();
  const { label, dot } = STATUS[status];

  return (
    <span
      role="status"
      className={cn("inline-flex items-center gap-2 text-xs text-muted-foreground", className)}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", dot)} />
      {label}
    </span>
  );
}
