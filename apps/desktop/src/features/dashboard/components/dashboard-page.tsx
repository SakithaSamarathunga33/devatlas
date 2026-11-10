import { AppInfoPanel } from "./app-info-panel";
import { LibrarySetupNotice } from "./library-setup-notice";
import { WelcomeHero } from "./welcome-hero";

export function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 lg:px-10">
      <WelcomeHero />
      <div className="mt-12 grid gap-5 lg:grid-cols-2">
        <AppInfoPanel />
        <LibrarySetupNotice />
      </div>
    </div>
  );
}
