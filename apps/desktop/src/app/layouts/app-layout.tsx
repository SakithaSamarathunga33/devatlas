import { Outlet } from "react-router";

import { AmbientBackground } from "@/components/layout/ambient-background";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BackendStatus } from "@/components/shared/backend-status";
import { LibraryWatcher } from "@/components/shared/library-watcher";
import { useAppInfo } from "@/hooks/use-app-info";
import { useLibrary } from "@/hooks/use-library";
import { formatPlatform } from "@/lib/platform";

export function AppLayout() {
  return (
    <div className="flex h-dvh overflow-hidden">
      <LibraryWatcher />
      <AppSidebar />
      <div className="relative isolate flex min-w-0 flex-1 flex-col">
        <AmbientBackground />
        <AppHeader />
        <main className="relative flex-1 overflow-x-hidden overflow-y-auto">
          <Outlet />
        </main>
        <StatusBar />
      </div>
    </div>
  );
}

function StatusBar() {
  const appInfo = useAppInfo();
  const library = useLibrary();
  return (
    <footer className="relative z-10 flex h-9 shrink-0 items-center gap-4 border-t border-white/[0.06] bg-background/70 px-4 text-xs text-muted-foreground backdrop-blur">
      <BackendStatus className="border-0 bg-transparent px-0 py-0 backdrop-blur-none" />
      {library.isSuccess && <span>{library.data.resources.length} resources</span>}
      <span className="ml-auto">
        {appInfo.isSuccess
          ? `DevAtlas ${appInfo.data.version} · ${formatPlatform(appInfo.data.platform)}`
          : "DevAtlas"}
      </span>
    </footer>
  );
}
