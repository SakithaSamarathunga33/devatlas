import { Search } from "lucide-react";

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name, e.g. "Search library". */
  label: string;
  placeholder: string;
}

/** A page's main search box. Ctrl+K focuses it (see AppHeader), so pages that render one
 * hide the header's search. */
export function SearchField({ value, onChange, label, placeholder }: SearchFieldProps) {
  return (
    <label className="relative block max-w-3xl flex-1">
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-muted-foreground"
      />
      <input
        data-search-shortcut
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="h-12 w-full rounded-xl border border-input bg-card pr-24 pl-11 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/30"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-1 font-sans text-[11px] text-muted-foreground">
        <span className="rounded border border-input bg-secondary px-1.5 py-0.5">Ctrl</span>+
        <span className="rounded border border-input bg-secondary px-1.5 py-0.5">K</span>
      </kbd>
    </label>
  );
}
