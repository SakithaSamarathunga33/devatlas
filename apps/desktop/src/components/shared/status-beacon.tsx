import { cn } from "@/lib/utils";

const TONES = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
} as const;

export type BeaconTone = keyof typeof TONES;

/** Status light; the ping ring only runs while the state is still changing. */
export function StatusBeacon({ tone, pulse = false }: { tone: BeaconTone; pulse?: boolean }) {
  return (
    <span aria-hidden className="relative flex size-2">
      {pulse && (
        <span
          className={cn(
            "absolute inline-flex size-full animate-ping rounded-full opacity-60 motion-reduce:hidden",
            TONES[tone],
          )}
        />
      )}
      <span className={cn("relative inline-flex size-2 rounded-full", TONES[tone])} />
    </span>
  );
}
