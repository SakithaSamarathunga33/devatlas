import { domAnimation, LazyMotion, m } from "motion/react";
import { useId } from "react";

interface ShareRingProps {
  /** 0–100. */
  percent: number;
  /** What the ring measures, read by screen readers, e.g. "95% of your library reviewed". */
  label: string;
}

const RING = {
  cx: 24,
  cy: 24,
  r: 20,
  fill: "none",
  strokeWidth: 4,
  strokeLinecap: "round",
} as const;

/**
 * A progress ring after Magic UI's Animated Circular Progress Bar: the arc carries the brand
 * gradient and springs in from empty (critically damped, so it settles without overshoot).
 * MotionConfig's `reducedMotion="user"` shows it at rest for people who ask for less motion.
 */
export function ShareRing({ percent, label }: ShareRingProps) {
  // useId's punctuation would break the `url(#…)` reference.
  const gradient = `ring-${useId().replace(/[^\w-]/g, "")}`;
  return (
    <LazyMotion features={domAnimation}>
      <div
        role="img"
        aria-label={label}
        className="relative grid size-14 shrink-0 place-items-center"
      >
        <svg viewBox="0 0 48 48" aria-hidden="true" className="absolute inset-0 -rotate-90">
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--gradient-from)" />
              <stop offset="100%" stopColor="var(--gradient-to)" />
            </linearGradient>
          </defs>
          <circle {...RING} stroke="var(--color-border)" />
          <m.circle
            {...RING}
            stroke={`url(#${gradient})`}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: percent / 100 }}
            transition={{ type: "spring", bounce: 0, duration: 0.9 }}
          />
        </svg>
        <span aria-hidden="true" className="tabular-display text-xs font-semibold">
          {percent}%
        </span>
      </div>
    </LazyMotion>
  );
}
