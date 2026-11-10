import { motion } from "motion/react";

const CENTER = 200;
const RADIUS = 180;
const TILT = `rotate(-18 ${String(CENTER)} ${String(CENTER)})`;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Meridians seen head-on are ellipses whose half-width is R·sin(longitude). */
const MERIDIAN_HALF_WIDTHS = [30, 60].map((longitude) => RADIUS * Math.sin(toRadians(longitude)));

/** Parallels seen edge-on are chords at height R·sin(latitude), half-width R·cos(latitude). */
const PARALLELS = [-60, -30, 0, 30, 60].map((latitude) => ({
  latitude,
  y: CENTER - RADIUS * Math.sin(toRadians(latitude)),
  halfWidth: RADIUS * Math.cos(toRadians(latitude)),
}));

function draw(order: number) {
  return {
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: { duration: 1.4, delay: 0.1 + order * 0.07, ease: "easeInOut" },
  } as const;
}

/** Decorative globe grid behind the dashboard welcome — the "atlas" in DevAtlas. */
export function Graticule({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" fill="none" aria-hidden className={className}>
      <g stroke="currentColor" strokeWidth={1} transform={TILT}>
        <motion.circle cx={CENTER} cy={CENTER} r={RADIUS} {...draw(0)} />
        <motion.line
          x1={CENTER}
          y1={CENTER - RADIUS}
          x2={CENTER}
          y2={CENTER + RADIUS}
          {...draw(1)}
        />
        {MERIDIAN_HALF_WIDTHS.map((rx, index) => (
          <motion.ellipse
            key={rx}
            cx={CENTER}
            cy={CENTER}
            rx={rx}
            ry={RADIUS}
            {...draw(index + 2)}
          />
        ))}
        {PARALLELS.map(({ latitude, y, halfWidth }, index) => (
          <motion.line
            key={latitude}
            x1={CENTER - halfWidth}
            y1={y}
            x2={CENTER + halfWidth}
            y2={y}
            className={latitude === 0 ? "stroke-info" : undefined}
            {...draw(index + 4)}
          />
        ))}
      </g>
    </svg>
  );
}
