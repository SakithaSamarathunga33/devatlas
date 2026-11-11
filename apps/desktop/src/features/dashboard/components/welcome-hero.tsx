import { format } from "date-fns";
import { Plus, Search } from "lucide-react";
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

/** Dashboard banner: a slate field with a mint glow and a faint map grid, drawn from the tokens.
 * `summary` is null until the library has loaded. */
export function WelcomeHero({ summary }: { summary: string | null }) {
  const now = new Date();

  return (
    <section
      aria-labelledby="welcome-heading"
      className="relative isolate overflow-hidden rounded-2xl border border-border bg-card"
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(60%_140%_at_100%_0%,var(--gradient-glow),transparent_70%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--grid-line)_1px,transparent_1px),linear-gradient(to_bottom,var(--grid-line)_1px,transparent_1px)] [mask-image:radial-gradient(70%_120%_at_100%_0%,black,transparent)] bg-[size:28px_28px]"
      />
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-4">
        <BlurFade>
          <h1
            id="welcome-heading"
            className="text-2xl font-semibold tracking-[-0.03em] text-balance"
          >
            {greeting(now.getHours())}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {format(now, "EEE, MMM d")}
            {summary !== null && ` · ${summary}`}
          </p>
        </BlurFade>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/library?add=1"
            className={cn(ACTION, "bg-primary text-primary-foreground hover:bg-primary-hover")}
          >
            <Plus className="size-4" aria-hidden />
            Add a link
          </Link>
          <Link
            to="/library"
            className={cn(
              ACTION,
              "border border-border bg-background/60 text-foreground hover:bg-background",
            )}
          >
            <Search className="size-4" aria-hidden />
            Search library
          </Link>
        </div>
      </div>
    </section>
  );
}
