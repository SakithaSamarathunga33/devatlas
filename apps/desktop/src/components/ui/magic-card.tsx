// Magic UI — MagicCard (https://magicui.design/docs/components/magic-card).
// Adapted for DevAtlas: dark-only (no next-themes), brand colours, card surface token.
import { motion, useMotionTemplate, useMotionValue } from "motion/react";
import { useCallback, useEffect, type PointerEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface MagicCardProps {
  children?: ReactNode;
  className?: string;
  /** Diameter of the cursor spotlight, in pixels. */
  gradientSize?: number;
  gradientColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
}

/** A surface whose border and fill light up around the pointer. */
export function MagicCard({
  children,
  className,
  gradientSize = 220,
  gradientColor = "rgb(139 108 255 / 0.10)",
  gradientFrom = "#8b6cff",
  gradientTo = "#3aa0ff",
}: MagicCardProps) {
  const mouseX = useMotionValue(-gradientSize);
  const mouseY = useMotionValue(-gradientSize);

  const border = useMotionTemplate`
    linear-gradient(var(--color-card) 0 0) padding-box,
    radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px, ${gradientFrom}, ${gradientTo}, var(--color-border) 100%) border-box
  `;
  const spotlight = useMotionTemplate`radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px, ${gradientColor}, transparent 100%)`;

  const reset = useCallback(() => {
    mouseX.set(-gradientSize);
    mouseY.set(-gradientSize);
  }, [gradientSize, mouseX, mouseY]);

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      mouseX.set(event.clientX - rect.left);
      mouseY.set(event.clientY - rect.top);
    },
    [mouseX, mouseY],
  );

  useEffect(() => {
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("blur", reset);
    };
  }, [reset]);

  return (
    <motion.div
      className={cn(
        "group relative isolate overflow-hidden rounded-2xl border border-transparent",
        className,
      )}
      onPointerMove={handlePointerMove}
      onPointerLeave={reset}
      style={{ background: border }}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-px z-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: spotlight }}
      />
      <div className="relative z-10 h-full">{children}</div>
    </motion.div>
  );
}
