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

import {
  resourceCategories,
  type ReadingStatus,
  type Resource,
  type ResourceCategory,
} from "@/types/library.types";

interface CategoryMeta {
  label: string;
  icon: LucideIcon;
  /** Gradient used for monograms and accents in this category (`--category-*` tokens). */
  tint: string;
  /** Solid colour for this category in charts and legends (`--category-*` tokens). */
  swatch: string;
}

export const CATEGORY_META: Record<ResourceCategory, CategoryMeta> = {
  "ui-components": {
    label: "UI components",
    icon: Component,
    tint: "from-category-ui/40 to-category-ui/10",
    swatch: "bg-category-ui",
  },
  inspiration: {
    label: "Design inspiration",
    icon: Palette,
    tint: "from-category-inspiration/40 to-category-inspiration/10",
    swatch: "bg-category-inspiration",
  },
  animation: {
    label: "Animation",
    icon: Sparkles,
    tint: "from-category-animation/40 to-category-animation/10",
    swatch: "bg-category-animation",
  },
  icons: {
    label: "Icons",
    icon: Shapes,
    tint: "from-category-icons/40 to-category-icons/10",
    swatch: "bg-category-icons",
  },
  tools: {
    label: "Tools & directories",
    icon: Wrench,
    tint: "from-category-tools/40 to-category-tools/10",
    swatch: "bg-category-tools",
  },
  cloud: {
    label: "Cloud consoles",
    icon: Cloud,
    tint: "from-category-cloud/40 to-category-cloud/10",
    swatch: "bg-category-cloud",
  },
  other: {
    label: "Other",
    icon: Link2,
    tint: "from-category-other/40 to-category-other/10",
    swatch: "bg-category-other",
  },
};

export const STATUS_LABELS: Record<ReadingStatus, string> = {
  "to-read": "To read",
  trying: "Trying",
  using: "Using",
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
