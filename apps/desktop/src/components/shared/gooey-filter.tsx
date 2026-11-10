import type { ReactNode } from "react";

import GooeyNav from "@/components/GooeyNav";
import { useUiStore } from "@/stores/ui-store";

/** The theme's primary, as a literal: the gooey canvas parses it and can't read CSS variables. */
const PILL = { dark: "#14b8a6", light: "#0f766e" } as const;

export interface GooeyFilterOption<T extends string> {
  value: T;
  label: string;
  count?: number;
  icon?: ReactNode;
}

interface GooeyFilterProps<T extends string> {
  /** Accessible name of the group, e.g. "Category". */
  label: string;
  options: readonly GooeyFilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** A single-choice filter row drawn with React Bits' Gooey Nav: the active pill flows to the
 * option you pick. Each option is a toggle button (aria-pressed) inside a named group. */
export function GooeyFilter<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: GooeyFilterProps<T>) {
  const theme = useUiStore((state) => state.theme);
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  return (
    <GooeyNav
      mode="toggle"
      label={label}
      theme={theme}
      color={PILL[theme]}
      size="sm"
      particleCount={10}
      // Canvas hover follows the pointer frame by frame and lags; a CSS fill is instant.
      hoverEffect={false}
      animationTime={350}
      items={options.map((option) => ({
        label:
          option.count === undefined ? option.label : `${option.label} ${String(option.count)}`,
        icon: option.icon,
      }))}
      activeIndex={activeIndex}
      onChange={(index) => {
        const option = options[index];
        if (option !== undefined) onChange(option.value);
      }}
      className={className}
    />
  );
}
