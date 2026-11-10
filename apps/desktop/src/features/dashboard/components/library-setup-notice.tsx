import { HardDrive, LibraryBig } from "lucide-react";

import { IconTile } from "@/components/shared/icon-tile";
import { MagicCard } from "@/components/ui/magic-card";

/** Honest empty state: the resource library does not exist yet in this milestone. */
export function LibrarySetupNotice() {
  return (
    <MagicCard className="h-full">
      <section aria-labelledby="library-setup-heading" className="flex h-full flex-col p-6">
        <IconTile icon={LibraryBig} />
        <h2 id="library-setup-heading" className="mt-5 text-sm font-semibold">
          Your library isn't set up yet
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          The desktop foundation is in place, but the resource library hasn't been initialized.
          Local storage and resource capture arrive in upcoming releases, so there is nothing to add
          here today.
        </p>
        <p className="mt-auto flex items-center gap-2 pt-5 text-xs text-muted-foreground">
          <HardDrive className="size-3.5" aria-hidden />
          Local-first: your library will live on this device.
        </p>
      </section>
    </MagicCard>
  );
}
