import { flushSync } from "react-dom";

const DURATION_MS = 400;

/** A number as a CSS percentage. */
const percent = (value: number) => `${String(value * 100)}%`;

/**
 * Applies a theme change as a circle that grows from `origin` over the whole window, using the
 * View Transitions API (after Magic UI's animated theme toggler). Without the API, or with
 * reduced motion, the change is instant. `apply` must update the DOM synchronously.
 */
export function revealThemeChange(origin: HTMLElement, apply: () => void): void {
  const root = document.documentElement;
  if (root.dataset.themeReveal === "active") return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (typeof document.startViewTransition !== "function" || reduceMotion) {
    apply();
    return;
  }

  const { left, top, width, height } = origin.getBoundingClientRect();
  const x = left + width / 2;
  const y = top + height / 2;
  const viewWidth = window.innerWidth;
  const viewHeight = window.innerHeight;
  const radius = Math.hypot(Math.max(x, viewWidth - x), Math.max(y, viewHeight - y));
  // Percentages, not px: Chromium misplaces px clip paths on fractional display scales.
  const at = `${percent(x / viewWidth)} ${percent(y / viewHeight)}`;
  const fullRadius = percent(radius / (Math.hypot(viewWidth, viewHeight) / Math.SQRT2));
  const clipPath = [`circle(0% at ${at})`, `circle(${fullRadius} at ${at})`];

  root.dataset.themeReveal = "active";
  root.style.setProperty("--theme-reveal-duration", `${String(DURATION_MS)}ms`);
  root.style.setProperty("--theme-reveal-from", clipPath[0] ?? "none");
  const transition = document.startViewTransition(() => {
    flushSync(apply);
  });
  transition.ready
    .then(() => {
      root.animate(
        { clipPath },
        {
          duration: DURATION_MS,
          easing: "ease-in-out",
          fill: "forwards",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    })
    .catch(() => undefined);
  transition.finished
    .finally(() => {
      delete root.dataset.themeReveal;
      root.style.removeProperty("--theme-reveal-duration");
      root.style.removeProperty("--theme-reveal-from");
    })
    .catch(() => undefined);
}
