import {
  Cloud,
  Component,
  Link2,
  Palette,
  Shapes,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { resourceCategories, type Resource, type ResourceCategory } from "@/types/library.types";

interface CategoryMeta {
  label: string;
  icon: LucideIcon;
  /** Gradient used for monograms and accents in this category. */
  tint: string;
}

export const CATEGORY_META: Record<ResourceCategory, CategoryMeta> = {
  "ui-components": {
    label: "UI components",
    icon: Component,
    tint: "from-violet-500/40 to-fuchsia-500/10",
  },
  inspiration: {
    label: "Design inspiration",
    icon: Palette,
    tint: "from-pink-500/40 to-orange-400/10",
  },
  animation: { label: "Animation", icon: Sparkles, tint: "from-sky-500/40 to-indigo-500/10" },
  icons: { label: "Icons", icon: Shapes, tint: "from-emerald-500/40 to-teal-500/10" },
  tools: { label: "Tools & directories", icon: Wrench, tint: "from-amber-500/40 to-yellow-500/10" },
  cloud: { label: "Cloud consoles", icon: Cloud, tint: "from-blue-500/40 to-cyan-400/10" },
  other: { label: "Other", icon: Link2, tint: "from-zinc-400/30 to-zinc-500/10" },
};

/** Categories that have resources, in display order, with their counts. */
export function countByCategory(
  resources: readonly Resource[],
): { category: ResourceCategory; count: number }[] {
  return resourceCategories
    .map((category) => ({
      category,
      count: resources.filter((resource) => resource.category === category).length,
    }))
    .filter(({ count }) => count > 0);
}
