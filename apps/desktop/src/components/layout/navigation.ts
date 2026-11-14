import {
  Code2,
  Compass,
  FolderGit2,
  Layers,
  LayoutDashboard,
  Library,
  Newspaper,
  Settings,
  Telescope,
  Trophy,
  Users,
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

/** A titled group of pages in the sidebar. */
export interface NavigationSection {
  title: string;
  items: readonly NavigationItem[];
}

/** First and alone, without a section heading. */
export const homeNavigation: NavigationItem = {
  label: "Dashboard",
  icon: LayoutDashboard,
  to: "/",
};

export const navigationSections: readonly NavigationSection[] = [
  {
    title: "Library",
    items: [
      { label: "Library", icon: Library, to: "/library" },
      {
        label: "Saved repos",
        icon: FolderGit2,
        to: "/saved-repos",
        description: "The GitHub repositories you saved, with their language and stars.",
      },
      {
        label: "Collections",
        icon: Layers,
        to: "/collections",
        description: "Group resources into curated sets for a stack, a client, or an idea.",
      },
      {
        label: "Snippets",
        icon: Code2,
        to: "/snippets",
        description: "Small pieces of code worth keeping.",
      },
    ],
  },
  {
    title: "Discover",
    items: [
      {
        label: "Explorer",
        icon: Compass,
        to: "/explorer",
        description:
          "Your links and suggested starting points by ecosystem: React, Vue, Rust, Go, and more.",
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
        description:
          "Top developer stories and official language, framework, database and tool blogs.",
      },
      {
        label: "Languages",
        icon: Trophy,
        to: "/rankings",
        description: "How popular programming languages are (TIOBE and PYPL, monthly).",
      },
    ],
  },
  {
    title: "Community",
    items: [
      {
        label: "Community",
        icon: Users,
        to: "/community",
        description: "Collections other developers shared, and a place to share yours.",
      },
    ],
  },
];

/** Every primary page in sidebar order, for search. */
export const primaryNavigation: readonly NavigationItem[] = [
  homeNavigation,
  ...navigationSections.flatMap((section) => section.items),
];

export const secondaryNavigation: readonly NavigationItem[] = [
  { label: "Settings", icon: Settings, to: "/settings" },
];
