interface ShareRingProps {
  /** 0–100. */
  percent: number;
  /** What the ring measures, read by screen readers, e.g. "95% of your library reviewed". */
  label: string;
}

const RING = { cx: 18, cy: 18, r: 16, fill: "none", strokeWidth: 3.5, pathLength: 100 };

/** A static progress ring: Astryx only ships a linear bar. */
export function ShareRing({ percent, label }: ShareRingProps) {
  return (
    <svg role="img" aria-label={label} viewBox="0 0 36 36" className="size-12 shrink-0 -rotate-90">
      <title>{label}</title>
      <circle {...RING} stroke="var(--color-border)" />
      <circle {...RING} stroke="var(--color-accent)" strokeDasharray={`${String(percent)} 100`} />
    </svg>
  );
}
