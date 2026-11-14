import { AppShell } from "@astryxdesign/core/AppShell";
import { LinkProvider } from "@astryxdesign/core/Link";
import type { ComponentProps } from "react";
import { Link, Outlet } from "react-router";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { LibraryWatcher } from "@/components/shared/library-watcher";
import { useOnboarded, WelcomeScreen } from "@/features/welcome";

/** Astryx links route in-app, so the window never reloads. */
function RouterLink({
  href,
  ...props
}: Omit<ComponentProps<typeof Link>, "to"> & { href: string }) {
  return <Link to={href} {...props} />;
}

export function AppLayout() {
  const onboarded = useOnboarded();

  // Nothing until the answer is known, so the dashboard never flashes before the welcome. If
  // it can't be read, the app opens normally rather than trapping anyone on the welcome.
  if (onboarded.isPending) return null;
  if (onboarded.data === false) return <WelcomeScreen />;

  return (
    <LinkProvider component={RouterLink}>
      <LibraryWatcher />
      <AppShell
        height="fill"
        variant="elevated"
        mobileNav={false}
        topNav={<AppHeader />}
        sideNav={<AppSidebar />}
      >
        <div className="content-surface flex h-full min-h-0 flex-col overflow-hidden">
          {/* `relative` keeps absolutely positioned descendants inside this scroll container. */}
          <div className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            <Outlet />
          </div>
        </div>
      </AppShell>
    </LinkProvider>
  );
}
