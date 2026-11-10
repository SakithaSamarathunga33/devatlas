import { LibraryBig } from "lucide-react";

/** Honest empty state: the resource library does not exist yet in this milestone. */
export function LibrarySetupNotice() {
  return (
    <section
      aria-labelledby="library-setup-heading"
      className="flex flex-col rounded-xl border border-dashed border-border bg-background p-6"
    >
      <div className="flex size-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
        <LibraryBig className="size-4.5" aria-hidden />
      </div>
      <h2 id="library-setup-heading" className="mt-5 text-sm font-medium">
        Your library isn't set up yet
      </h2>
      <p className="mt-1.5 max-w-[52ch] text-sm leading-relaxed text-muted-foreground">
        The desktop foundation is in place, but the resource library hasn't been initialized. Local
        storage and resource capture arrive in upcoming releases, so there is nothing to add here
        today.
      </p>
    </section>
  );
}
