import { TextInput } from "@astryxdesign/core/TextInput";
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
    <div className="max-w-sm min-w-48 flex-1">
      <TextInput
        type="search"
        label={label}
        isLabelHidden
        placeholder={placeholder}
        startIcon={Search}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
