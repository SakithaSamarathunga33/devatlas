import { NavLink } from "react-router";

import {
  primaryNavigation,
  secondaryNavigation,
  type NavigationItem,
} from "@/components/layout/navigation";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";

export function AppSidebar() {
  const collapsed = useUiStore((state) => state.sidebarCollapsed);

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out motion-reduce:transition-none",
        collapsed ? "w-15" : "w-60",
      )}
    >
      <div className="flex h-14 items-center gap-2.5 overflow-hidden px-3.5">
        <img
          src="/devatlas-mark.png"
          alt={collapsed ? "DevAtlas" : ""}
          width={32}
          height={32}
          className="size-8 shrink-0"
        />
        {!collapsed && <span className="text-[15px] font-semibold tracking-tight">DevAtlas</span>}
      </div>

      <nav aria-label="Primary" className="flex flex-1 flex-col px-2.5 pt-3 pb-3">
        <NavigationList items={primaryNavigation} collapsed={collapsed} />
        <NavigationList items={secondaryNavigation} collapsed={collapsed} className="mt-auto" />
      </nav>
    </aside>
  );
}

interface NavigationListProps {
  items: readonly NavigationItem[];
  collapsed: boolean;
  className?: string;
}

function NavigationList({ items, collapsed, className }: NavigationListProps) {
  return (
    <ul className={cn("flex flex-col gap-0.5", className)}>
      {items.map((item) => (
        <li key={item.label}>
          <SidebarItem item={item} collapsed={collapsed} />
        </li>
      ))}
    </ul>
  );
}

const itemBase =
  "relative flex h-9 items-center gap-3 rounded-md px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring";

function SidebarItem({ item, collapsed }: { item: NavigationItem; collapsed: boolean }) {
  const Icon = item.icon;
  const available = item.to !== undefined;

  const content = (
    <>
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className={cn("truncate", collapsed && "sr-only")}>{item.label}</span>
      {!available &&
        (collapsed ? (
          <span className="sr-only">(coming soon)</span>
        ) : (
          <Badge
            variant="outline"
            className="ml-auto h-5 border-sidebar-border px-1.5 text-[11px] font-normal text-muted-foreground"
          >
            Soon
          </Badge>
        ))}
    </>
  );

  const element =
    item.to === undefined ? (
      <span
        aria-disabled="true"
        className={cn(itemBase, "cursor-default text-muted-foreground/50")}
      >
        {content}
      </span>
    ) : (
      <NavLink
        to={item.to}
        end
        className={({ isActive }) =>
          cn(
            itemBase,
            "transition-colors",
            isActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:inset-y-2 before:-left-2.5 before:w-0.5 before:rounded-full before:bg-sidebar-primary"
              : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
          )
        }
      >
        {content}
      </NavLink>
    );

  if (!collapsed) return element;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{element}</TooltipTrigger>
      <TooltipContent side="right">
        {available ? item.label : `${item.label} (coming soon)`}
      </TooltipContent>
    </Tooltip>
  );
}
