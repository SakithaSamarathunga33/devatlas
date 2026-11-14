import {
  SideNav,
  SideNavCollapseButton,
  SideNavItem,
  SideNavSection,
} from "@astryxdesign/core/SideNav";
import { useLocation } from "react-router";

import {
  homeNavigation,
  navigationSections,
  secondaryNavigation,
  type NavigationItem,
} from "@/components/layout/navigation";
import { AccountNavItem } from "@/components/layout/account-nav-item";
import { UpdateNavItem } from "@/components/layout/update-nav-item";
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
      // The collapse button sits above the pages instead of in a bottom icon bar.
      collapsible={{ isCollapsed: collapsed, onCollapsedChange: toggleSidebar, hasButton: false }}
      topContent={<SideNavCollapseButton />}
      footer={
        <>
          <UpdateNavItem />
          {secondaryNavigation.map((item) => (
            <NavItem key={item.label} item={item} pathname={pathname} />
          ))}
          <AccountNavItem />
        </>
      }
    >
      <SideNavSection title="Home" isHeaderHidden>
        <NavItem item={homeNavigation} pathname={pathname} />
      </SideNavSection>
      {/* Collapsed, SideNav hides the headings; the gap keeps the groups apart. */}
      {navigationSections.map((section) => (
        <SideNavSection key={section.title} title={section.title} className="mt-3">
          {section.items.map((item) => (
            <NavItem key={item.label} item={item} pathname={pathname} />
          ))}
        </SideNavSection>
      ))}
    </SideNav>
  );
}
