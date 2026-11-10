import { format } from "date-fns";
import { CalendarDays } from "lucide-react";

import { BlurFade } from "@/components/ui/blur-fade";

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Dashboard banner. Photo: Unsplash (free to use under the Unsplash License), bundled locally. */
export function WelcomeHero() {
  const now = new Date();

  return (
    <section
      aria-labelledby="welcome-heading"
      className="relative isolate overflow-hidden rounded-2xl border border-white/[0.06]"
    >
      <img
        src="/hero-mountains.jpg"
        alt=""
        className="absolute inset-0 -z-10 size-full object-cover object-[center_40%]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-linear-to-r from-background via-background/75 to-background/10"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-linear-to-t from-background/90 via-transparent to-transparent"
      />
      <div className="flex min-h-[200px] flex-col gap-4 px-8 py-9 sm:flex-row sm:items-start sm:justify-between">
        <BlurFade>
          <h1
            id="welcome-heading"
            className="text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-4xl"
          >
            {greeting(now.getHours())} <span aria-hidden>👋</span>
          </h1>
          <p className="mt-2 text-[15px] text-foreground/75">
            Explore, organize and find the best developer resources.
          </p>
        </BlurFade>
        <span className="inline-flex items-center gap-2 self-start rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-foreground/90 backdrop-blur">
          <CalendarDays className="size-4" aria-hidden />
          {format(now, "EEE, MMM d, yyyy")}
        </span>
      </div>
    </section>
  );
}
