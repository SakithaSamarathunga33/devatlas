import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

/** Filters a feed down to what matches the user's tags and library. */
export function ForYouToggle({
  active,
  disabled,
  onToggle,
}: {
  active: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      title={disabled ? "Add tags to your links first" : "Show what matches your tags and library"}
      onClick={onToggle}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 [&>svg]:size-4",
        active
          ? "border-transparent bg-primary font-medium text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      <Sparkles aria-hidden />
      For you
    </button>
  );
}
