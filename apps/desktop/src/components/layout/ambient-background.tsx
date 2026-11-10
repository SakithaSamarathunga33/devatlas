import Aurora from "@/components/ui/aurora";
import { supportsWebGL } from "@/lib/webgl";

const AURORA_STOPS = ["#7c2d12", "#f59e0b", "#b45309"];

/** Decorative light behind the header and hero: React Bits Aurora over a faint dot grid. */
export function AmbientBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-[560px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_30%,transparent)]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.08)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_top,black_15%,transparent_70%)] [background-size:22px_22px]" />
      {supportsWebGL && (
        <Aurora
          className="absolute inset-0"
          colorStops={AURORA_STOPS}
          amplitude={1.1}
          blend={0.6}
          height={0.3}
          speed={0.5}
          layers={2}
          opacity={0.6}
        />
      )}
    </div>
  );
}
