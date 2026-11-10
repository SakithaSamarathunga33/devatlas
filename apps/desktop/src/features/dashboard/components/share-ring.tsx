import { AnimatedCircularProgressBar } from "@/components/ui/animated-circular-progress-bar";
import { cn } from "@/lib/utils";

interface ShareRingProps {
  /** 0–100. */
  percent: number;
  /** What the ring measures, read by screen readers, e.g. "UI components: 33% of your library". */
  label: string;
  /** Show the number inside the ring (large rings only). */
  showValue?: boolean;
  className?: string;
}

/** Magic UI's animated ring in the theme's mint, on the theme's track colour. */
export function ShareRing({ percent, label, showValue = false, className }: ShareRingProps) {
  return (
    <span role="img" aria-label={label} title={label} className="shrink-0">
      <AnimatedCircularProgressBar
        value={Math.round(percent)}
        gaugePrimaryColor="var(--primary)"
        gaugeSecondaryColor="var(--accent)"
        className={cn(
          "font-semibold text-foreground tabular-nums",
          !showValue && "[&>span]:hidden",
          className,
        )}
      />
    </span>
  );
}
