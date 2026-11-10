import { NavLink } from "react-router";

import {
  primaryNavigation,
  secondaryNavigation,
  type NavigationItem,
} from "@/components/layout/navigation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";

export function AppSidebar() {
  const collapsed = useUiStore((state) => state.sidebarCollapsed);

  return (
    <aside
      className={cn(
        "relative z-20 flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-out motion-reduce:transition-none",
        collapsed ? "w-[68px]" : "w-64",
      )}
    >
      <div data-tauri-drag-region className="flex h-14 items-center gap-3 overflow-hidden px-4">
        <img
          src="/devatlas-mark.png"
          alt={collapsed ? "DevAtlas" : ""}
          width={36}
          height={36}
          className="size-9 shrink-0 outline-none"
        />
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="text-[15px] font-semibold tracking-tight text-sidebar-accent-foreground">
              DevAtlas
            </p>
            <p className="truncate text-xs text-sidebar-foreground/65">Developer resource atlas</p>
          </div>
        )}
      </div>

      <nav aria-label="Primary" className="flex flex-1 flex-col px-3 pt-4 pb-3">
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
    <ul className={cn("flex flex-col gap-1", className)}>
      {items.map((item) => (
        <li key={item.label}>
          <SidebarItem item={item} collapsed={collapsed} />
        </li>
      ))}
    </ul>
  );
}

const itemBase =
  "relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring";

function SidebarItem({ item, collapsed }: { item: NavigationItem; collapsed: boolean }) {
  const Icon = item.icon;
  const available = item.to !== undefined;

  const content = (
    <>
      <Icon className="size-[18px] shrink-0" aria-hidden />
      <span className={cn("truncate", collapsed && "sr-only")}>{item.label}</span>
      {!available &&
        (collapsed ? (
          <span className="sr-only">(coming soon)</span>
        ) : (
          <span className="ml-auto rounded-full border border-sidebar-foreground/15 px-1.5 py-px text-[11px] text-sidebar-foreground/60">
            Soon
          </span>
        ))}
    </>
  );

  const element =
    item.to === undefined ? (
      <span
        aria-disabled="true"
        className={cn(itemBase, "cursor-default text-sidebar-foreground/45")}
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
            "transition-[background-color,color,box-shadow] duration-200",
            isActive
              ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground [&>svg]:text-sidebar-primary"
              : "text-sidebar-foreground/75 hover:bg-white/[0.06] hover:text-sidebar-accent-foreground",
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
