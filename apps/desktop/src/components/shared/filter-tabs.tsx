import { Tab, TabList } from "@astryxdesign/core/TabList";
import { Text } from "@astryxdesign/core/Text";
import type { ReactNode } from "react";

export interface FilterTabsOption<T extends string> {
  value: T;
  label: string;
  count?: number;
  icon?: ReactNode;
}

interface FilterTabsProps<T extends string> {
  /** Accessible name of the group, e.g. "Category". */
  label: string;
  options: readonly FilterTabsOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** A single-choice filter row. Wide sets scroll or collapse inside the strip. */
export function FilterTabs<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: FilterTabsProps<T>) {
  return (
    <div className={className}>
      <TabList
        aria-label={label}
        size="sm"
        value={value}
        onChange={(next) => {
          const option = options.find((candidate) => candidate.value === next);
          if (option !== undefined) onChange(option.value);
        }}
      >
        {options.map((option) => (
          <Tab
            key={option.value}
            value={option.value}
            label={option.label}
            icon={option.icon}
            endContent={
              option.count === undefined ? undefined : (
                <Text type="supporting" hasTabularNumbers>
                  {option.count}
                </Text>
              )
            }
          />
        ))}
      </TabList>
    </div>
  );
}
