import { AnimatedCircularProgressBar } from "@/components/ui/animated-circular-progress-bar";
import { cn } from "@/lib/utils";

interface ShareRingProps {
  /** 0–100. */
  percent: number;
  /** What the ring measures, read by screen readers, e.g. "95% of your library reviewed". */
  label: string;
  className?: string;
}

/** Magic UI's animated ring in the theme's mint, on the theme's track colour, without its number. */
export function ShareRing({ percent, label, className }: ShareRingProps) {
  return (
    <span role="img" aria-label={label} title={label} className="shrink-0">
      <AnimatedCircularProgressBar
        value={Math.round(percent)}
        gaugePrimaryColor="var(--primary)"
        gaugeSecondaryColor="var(--accent)"
        className={cn("[&>span]:hidden", className)}
      />
    </span>
  );
}
