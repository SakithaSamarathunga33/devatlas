import { SideNav, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";
import { useLocation } from "react-router";

import {
  primaryNavigation,
  secondaryNavigation,
  type NavigationItem,
} from "@/components/layout/navigation";
import { useUiStore } from "@/stores/ui-store";

function isActive(to: string, pathname: string): boolean {
  // The dashboard matches exactly; /news/view and /library/:id keep their section active.
  return to === "/" ? pathname === "/" : pathname.startsWith(to);
}

function NavItem({ item, pathname }: { item: NavigationItem; pathname: string }) {
  return (
    <SideNavItem
      label={item.label}
      icon={item.icon}
      href={item.to}
      isDisabled={item.to === undefined}
      isSelected={item.to !== undefined && isActive(item.to, pathname)}
    />
  );
}

export function AppSidebar() {
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const { pathname } = useLocation();

  return (
    <SideNav
      aria-label="Primary"
      collapsible={{ isCollapsed: collapsed, onCollapsedChange: toggleSidebar }}
      footer={secondaryNavigation.map((item) => (
        <NavItem key={item.label} item={item} pathname={pathname} />
      ))}
    >
      <SideNavSection title="Pages" isHeaderHidden>
        {primaryNavigation.map((item) => (
          <NavItem key={item.label} item={item} pathname={pathname} />
        ))}
      </SideNavSection>
    </SideNav>
  );
}
