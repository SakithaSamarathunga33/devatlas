import { Search } from "lucide-react";

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name, e.g. "Search library". */
  label: string;
  placeholder: string;
}

/** A page's own search box, filtering just that page. */
export function SearchField({ value, onChange, label, placeholder }: SearchFieldProps) {
  return (
    <label className="relative block max-w-sm min-w-48 flex-1">
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="h-9 w-full rounded-lg border border-input bg-card pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/30"
      />
    </label>
  );
}
