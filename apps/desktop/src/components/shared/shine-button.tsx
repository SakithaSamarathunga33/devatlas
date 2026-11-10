import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/** Uiverse-style pill button: gradient hairline border with a light sweep on hover. */
export function ShineButton({ className, children, ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "group/shine relative inline-flex h-9 items-center gap-2 overflow-hidden rounded-full px-4 text-sm font-medium text-foreground gradient-border",
        "shadow-[0_0_24px_-10px_var(--color-primary)] transition-shadow duration-300 hover:shadow-[0_0_32px_-8px_var(--color-primary)]",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-60 [&_svg]:size-4",
        "before:pointer-events-none before:absolute before:inset-y-0 before:-left-full before:w-1/2 before:skew-x-[-20deg] before:bg-linear-to-r before:from-transparent before:via-white/20 before:to-transparent before:transition-[left] before:duration-700 hover:before:left-[150%] motion-reduce:before:hidden",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
