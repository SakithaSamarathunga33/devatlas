import { NavLink, useLocation, useNavigate } from "react-router";

import GooeyNav from "@/components/GooeyNav";
import {
  primaryNavigation,
  secondaryNavigation,
  type NavigationItem,
} from "@/components/layout/navigation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";

/** The theme's primary, as a literal: the gooey canvas parses it and can't read CSS variables. */
const PILL = { dark: "#14b8a6", light: "#0f766e" } as const;

type Page = NavigationItem & { to: string };

function isPage(item: NavigationItem): item is Page {
  return item.to !== undefined;
}

function isActive(page: Page, pathname: string): boolean {
  // The dashboard matches exactly; /news/view and /library/:id keep their section active.
  return page.to === "/" ? pathname === "/" : pathname.startsWith(page.to);
}

export function AppSidebar() {
  const collapsed = useUiStore((state) => state.sidebarCollapsed);

  return (
    <aside
      className={cn(
        "relative z-20 flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-out select-none motion-reduce:transition-none",
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
            <p className="text-base font-semibold tracking-tight text-sidebar-accent-foreground">
              DevAtlas
            </p>
            <p className="truncate text-xs text-sidebar-foreground/80">Developer resource atlas</p>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col px-3 pt-4 pb-3">
        <PageNavigation collapsed={collapsed} />
        <ComingSoon collapsed={collapsed} />
        <NavigationList items={secondaryNavigation} collapsed={collapsed} className="mt-auto" />
      </div>
    </aside>
  );
}

/** The pages that exist, as React Bits' Gooey Nav: the active pill flows to the page you
 * open. Items are buttons that route in-app, so the window never reloads. */
function PageNavigation({ collapsed }: { collapsed: boolean }) {
  const theme = useUiStore((state) => state.theme);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const pages = primaryNavigation.filter(isPage);
  const active = pages.findIndex((page) => isActive(page, pathname));

  return (
    <GooeyNav
      label="Primary"
      orientation="vertical"
      frame={false}
      theme={theme}
      color={PILL[theme]}
      particleCount={12}
      // Canvas hover follows the pointer frame by frame and lags; a CSS fill is instant.
      hoverEffect={false}
      animationTime={350}
      className="w-full"
      items={pages.map((page) => {
        const Icon = page.icon;
        return {
          label: collapsed ? undefined : page.label,
          ariaLabel: collapsed ? page.label : undefined,
          icon: <Icon aria-hidden />,
        };
      })}
      // -1 on Settings, which lives outside this list: no page is active.
      activeIndex={active}
      onChange={(index) => {
        const page = pages[index];
        if (page !== undefined && !isActive(page, pathname)) void navigate(page.to);
      }}
    />
  );
}

/** Planned modules, honestly labelled; they can't be opened yet. */
function ComingSoon({ collapsed }: { collapsed: boolean }) {
  const planned = primaryNavigation.filter((item) => !isPage(item));
  if (planned.length === 0) return null;
  return (
    <section aria-label="Coming soon" className="mt-5">
      {!collapsed && (
        <p className="mb-1.5 px-3 text-xs font-medium tracking-wide text-sidebar-foreground/80 uppercase">
          Coming soon
        </p>
      )}
      <NavigationList items={planned} collapsed={collapsed} />
    </section>
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
          <span className="ml-auto text-xs text-sidebar-foreground/80">Soon</span>
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
        // Only the dashboard needs an exact match; /news/view and /library/:id keep their
        // section highlighted.
        end={item.to === "/"}
        // A plain string, not NavLink's className function: when collapsed, the link sits in a
        // Radix tooltip trigger (Slot), which can only merge string class names. NavLink marks
        // the active link with aria-current="page", so the active style keys off that.
        className={cn(
          itemBase,
          "text-sidebar-foreground/75 transition-[background-color,color] duration-200 hover:text-sidebar-accent-foreground not-aria-[current=page]:hover:bg-accent",
          "aria-[current=page]:bg-sidebar-primary/10 aria-[current=page]:font-medium aria-[current=page]:text-sidebar-accent-foreground aria-[current=page]:ring-1 aria-[current=page]:ring-sidebar-primary/35 aria-[current=page]:ring-inset aria-[current=page]:[&>svg]:text-sidebar-primary",
        )}
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
