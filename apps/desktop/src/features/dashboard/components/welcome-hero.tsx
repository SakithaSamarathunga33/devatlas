import { format } from "date-fns";
import { CalendarDays, Plus, Search } from "lucide-react";
import { Link } from "react-router";

import { BlurFade } from "@/components/ui/blur-fade";
import { cn } from "@/lib/utils";

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const ACTION =
  "inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Dashboard banner. Photo: Unsplash (free to use under the Unsplash License), bundled locally. */
export function WelcomeHero() {
  const now = new Date();

  return (
    <section
      aria-labelledby="welcome-heading"
      className="relative isolate overflow-hidden rounded-2xl border border-border"
    >
      <img
        src="/hero-mountains.jpg"
        alt=""
        className="absolute inset-0 -z-10 size-full object-cover object-[center_40%]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-linear-to-r from-background via-background/80 to-background/10"
      />
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5 px-7 py-5">
        <BlurFade>
          <h1
            id="welcome-heading"
            className="text-3xl font-semibold tracking-[-0.03em] text-balance"
          >
            {greeting(now.getHours())} <span aria-hidden>👋</span>
          </h1>
          <p className="mt-1.5 text-[15px] text-foreground/75">
            Explore, organize and find the best developer resources.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/library?add=1"
              className={cn(ACTION, "bg-primary text-primary-foreground hover:bg-primary/90")}
            >
              <Plus className="size-4" aria-hidden />
              Add a link
            </Link>
            <Link
              to="/library"
              className={cn(
                ACTION,
                "border border-border bg-background/70 text-foreground backdrop-blur hover:bg-background/90",
              )}
            >
              <Search className="size-4" aria-hidden />
              Search library
            </Link>
          </div>
        </BlurFade>
        <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-background/70 px-3 py-1.5 text-sm text-foreground/90 backdrop-blur">
          <CalendarDays className="size-4" aria-hidden />
          {format(now, "EEE, MMM d, yyyy")}
        </span>
      </div>
    </section>
  );
}
