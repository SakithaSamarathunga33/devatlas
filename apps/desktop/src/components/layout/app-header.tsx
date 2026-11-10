import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { BackendStatus } from "@/components/shared/backend-status";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/use-page-title";
import { useUiStore } from "@/stores/ui-store";

export function AppHeader() {
  const title = usePageTitle();
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  return (
    <header className="relative z-10 flex h-16 shrink-0 items-center gap-2 border-b border-white/[0.06] bg-background/30 px-4 backdrop-blur-xl">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={toggleSidebar}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
        className="text-muted-foreground hover:bg-white/[0.06]"
      >
        {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
      </Button>
      <span className="text-sm font-medium">{title}</span>
      <BackendStatus className="ml-auto" />
    </header>
  );
}
