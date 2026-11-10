import { Outlet } from "react-router";

import { AmbientBackground } from "@/components/layout/ambient-background";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";

export function AppLayout() {
  return (
    <div className="flex h-dvh overflow-hidden">
      <AppSidebar />
      <div className="relative isolate flex min-w-0 flex-1 flex-col">
        <AmbientBackground />
        <AppHeader />
        <main className="relative flex-1 overflow-x-hidden overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
