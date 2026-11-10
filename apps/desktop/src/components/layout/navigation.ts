import {
  Compass,
  FolderKanban,
  Layers,
  LayoutDashboard,
  Library,
  Settings,
  Telescope,
  type LucideIcon,
} from "lucide-react";

export interface NavigationItem {
  label: string;
  icon: LucideIcon;
  /** Route path. Omitted while the feature is not implemented yet. */
  to?: string;
}

export const primaryNavigation: readonly NavigationItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/" },
  { label: "Library", icon: Library },
  { label: "Collections", icon: Layers },
  { label: "Explorer", icon: Compass },
  { label: "Discovery", icon: Telescope },
  { label: "Projects", icon: FolderKanban },
];

export const secondaryNavigation: readonly NavigationItem[] = [
  { label: "Settings", icon: Settings },
];
