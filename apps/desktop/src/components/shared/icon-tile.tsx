import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Glowing gradient square that frames a section or tile icon. */
export function IconTile({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <div
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-primary/30 to-info/10 shadow-[0_0_24px_-8px_var(--color-primary)] ring-1 ring-white/10 ring-inset",
        className,
      )}
    >
      <Icon className="size-[18px] text-primary" aria-hidden />
    </div>
  );
}
