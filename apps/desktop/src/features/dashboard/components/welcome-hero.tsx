import { Sparkles } from "lucide-react";

import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";
import { AuroraText } from "@/components/ui/aurora-text";
import { BlurFade } from "@/components/ui/blur-fade";
import { Globe } from "@/components/ui/globe";
import RotatingText from "@/components/ui/rotating-text";
import { supportsWebGL } from "@/lib/webgl";

const TOPICS = ["UI components", "libraries", "developer tools", "design systems", "references"];
const BRAND_GRADIENT = ["#c4b5fd", "#8b6cff", "#3aa0ff", "#22d3ee"];

export function WelcomeHero() {
  return (
    <section
      aria-labelledby="welcome-heading"
      className="grid min-h-[380px] items-center gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
    >
      <div>
        <BlurFade>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs backdrop-blur">
            <Sparkles className="size-3.5 text-violet-300" aria-hidden />
            <AnimatedShinyText className="mx-0 max-w-none">Foundation preview</AnimatedShinyText>
          </span>
        </BlurFade>

        <BlurFade delay={0.08}>
          <h1
            id="welcome-heading"
            className="mt-5 text-4xl leading-[1.05] font-semibold tracking-[-0.035em] text-balance sm:text-5xl xl:text-6xl"
          >
            Welcome to <AuroraText colors={BRAND_GRADIENT}>DevAtlas</AuroraText>
          </h1>
        </BlurFade>

        <BlurFade delay={0.16}>
          <p className="mt-6 flex flex-wrap items-center gap-x-2.5 gap-y-2 text-lg text-foreground/90">
            Your atlas of
            <RotatingText
              texts={TOPICS}
              mainClassName="overflow-hidden rounded-lg bg-primary/15 px-2.5 py-0.5 text-violet-100 ring-1 ring-primary/30 ring-inset"
              staggerFrom="last"
              staggerDuration={0.02}
              rotationInterval={2600}
            />
          </p>
        </BlurFade>

        <BlurFade delay={0.24}>
          <p className="mt-4 max-w-[54ch] text-[15px] leading-relaxed text-pretty text-muted-foreground">
            Capture the resources you rely on once, then find them again when a project needs them.
            Everything stays on this machine.
          </p>
        </BlurFade>
      </div>

      {supportsWebGL && (
        <div
          aria-hidden
          className="relative mx-auto hidden aspect-square w-full max-w-[420px] lg:block"
        >
          <div className="absolute inset-[14%] rounded-full bg-primary/25 blur-[90px]" />
          <Globe />
        </div>
      )}
    </section>
  );
}
