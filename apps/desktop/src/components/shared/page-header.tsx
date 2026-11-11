import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description: ReactNode;
  /** The page's own controls, shown beside the title. */
  children?: ReactNode;
}

/** The title row every page shares, so moving between pages doesn't change the top of the app. */
export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <Heading level={1}>{title}</Heading>
        <Text type="supporting" as="p">
          {description}
        </Text>
      </div>
      {children}
    </div>
  );
}
