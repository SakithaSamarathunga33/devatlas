import { primaryNavigation } from "@/components/layout/navigation";
import { IconTile } from "@/components/shared/icon-tile";
import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";
import { cn } from "@/lib/utils";

/** Modules that exist in navigation but are not built yet. */
const PLANNED = primaryNavigation.filter((item) => item.to === undefined);

export function RoadmapGrid() {
  return (
    <section aria-labelledby="roadmap-heading" className="mt-14">
      <h2 id="roadmap-heading" className="text-lg font-semibold tracking-tight">
        What's on the way
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Planned modules. None of them are available yet.
      </p>

      <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLANNED.map((item, index) => (
          <li key={item.label} className={cn(index === 0 && "sm:col-span-2")}>
            <BlurFade delay={0.4 + index * 0.05} className="h-full">
              <MagicCard className="h-full">
                <article className="flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <IconTile icon={item.icon} />
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-muted-foreground">
                      Planned
                    </span>
                  </div>
                  <h3 className="mt-4 text-sm font-semibold">{item.label}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </article>
              </MagicCard>
            </BlurFade>
          </li>
        ))}
      </ul>
    </section>
  );
}
