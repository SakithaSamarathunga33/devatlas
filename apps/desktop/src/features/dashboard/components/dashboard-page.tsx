import { BlurFade } from "@/components/ui/blur-fade";

import { AppInfoPanel } from "./app-info-panel";
import { LibrarySummary } from "./library-summary";
import { RoadmapGrid } from "./roadmap-grid";
import { WelcomeHero } from "./welcome-hero";

export function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 pt-8 pb-16 lg:px-10">
      <WelcomeHero />
      <div className="mt-6 grid gap-5 lg:grid-cols-5">
        <BlurFade delay={0.3} className="lg:col-span-3">
          <AppInfoPanel />
        </BlurFade>
        <BlurFade delay={0.36} className="lg:col-span-2">
          <LibrarySummary />
        </BlurFade>
      </div>
      <RoadmapGrid />
    </div>
  );
}
