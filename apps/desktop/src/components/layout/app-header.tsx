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
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={toggleSidebar}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
        className="text-muted-foreground"
      >
        {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
      </Button>
      <span className="text-sm font-medium">{title}</span>
      <BackendStatus className="ml-auto pr-2" />
    </header>
  );
}
