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
  /** What the module will do; shown on the dashboard roadmap for planned modules. */
  description?: string;
}

export const primaryNavigation: readonly NavigationItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/" },
  { label: "Library", icon: Library, to: "/library" },
  {
    label: "Collections",
    icon: Layers,
    description: "Group resources into curated sets for a stack, a client, or an idea.",
  },
  {
    label: "Explorer",
    icon: Compass,
    description: "Browse your library by ecosystem: React, Vue, Rust, Go, Python, and more.",
  },
  {
    label: "Discovery",
    icon: Telescope,
    description: "Find new packages, releases, and design inspiration worth saving.",
  },
  {
    label: "Projects",
    icon: FolderKanban,
    description: "Link resources to the projects that use them.",
  },
];

export const secondaryNavigation: readonly NavigationItem[] = [
  { label: "Settings", icon: Settings },
];
