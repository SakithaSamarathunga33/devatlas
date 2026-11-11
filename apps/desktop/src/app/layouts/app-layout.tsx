import { AppShell } from "@astryxdesign/core/AppShell";
import { LinkProvider } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import type { ComponentProps } from "react";
import { Link, Outlet } from "react-router";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BackendStatus } from "@/components/shared/backend-status";
import { LibraryWatcher } from "@/components/shared/library-watcher";
import { useAppInfo } from "@/hooks/use-app-info";
import { useLibrary } from "@/hooks/use-library";
import { formatPlatform } from "@/lib/platform";

/** Astryx links route in-app, so the window never reloads. */
function RouterLink({
  href,
  ...props
}: Omit<ComponentProps<typeof Link>, "to"> & { href: string }) {
  return <Link to={href} {...props} />;
}

export function AppLayout() {
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
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          {/* `relative` keeps absolutely positioned descendants inside this scroll container. */}
          <div className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            <Outlet />
          </div>
          <StatusBar />
        </div>
      </AppShell>
    </LinkProvider>
  );
}

function StatusBar() {
  const appInfo = useAppInfo();
  const library = useLibrary();
  return (
    <div className="flex h-9 shrink-0 items-center gap-4 border-t border-[var(--color-border)] px-4">
      <BackendStatus />
      {library.isSuccess && (
        <Text type="supporting">{library.data.resources.length} resources</Text>
      )}
      <span className="ml-auto">
        <Text type="supporting">
          {appInfo.isSuccess
            ? `DevAtlas ${appInfo.data.version} · ${formatPlatform(appInfo.data.platform)}`
            : "DevAtlas"}
        </Text>
      </span>
    </div>
  );
}
