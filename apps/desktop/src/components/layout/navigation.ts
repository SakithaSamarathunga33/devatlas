import {
  Compass,
  FolderKanban,
  Layers,
  LayoutDashboard,
  Library,
  Newspaper,
  Settings,
  Telescope,
  Trophy,
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
    to: "/collections",
    description: "Group resources into curated sets for a stack, a client, or an idea.",
  },
  {
    label: "Explorer",
    icon: Compass,
    description: "Browse your library by ecosystem: React, Vue, Rust, Go, Python, and more.",
  },
  {
    label: "Repos",
    icon: Telescope,
    to: "/discovery",
    description: "Find new packages, releases, and design inspiration worth saving.",
  },
  {
    label: "News",
    icon: Newspaper,
    to: "/news",
    description: "Top developer stories and official language, framework, database and tool blogs.",
  },
  {
    label: "Languages",
    icon: Trophy,
    to: "/rankings",
    description: "How popular programming languages are (TIOBE and PYPL, monthly).",
  },
  {
    label: "Projects",
    icon: FolderKanban,
    to: "/projects",
    description: "Link resources to the projects that use them.",
  },
];

export const secondaryNavigation: readonly NavigationItem[] = [
  { label: "Settings", icon: Settings, to: "/settings" },
];
