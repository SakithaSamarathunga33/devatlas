import { cn } from "@/lib/utils";

const TONES = {
  success: "bg-success shadow-[0_0_10px_var(--color-success)]",
  warning: "bg-warning shadow-[0_0_10px_var(--color-warning)]",
  destructive: "bg-destructive shadow-[0_0_10px_var(--color-destructive)]",
} as const;

export type BeaconTone = keyof typeof TONES;

/** Uiverse-style status light: a glowing dot with an expanding ping ring. */
export function StatusBeacon({ tone, pulse = true }: { tone: BeaconTone; pulse?: boolean }) {
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
