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
        <h1 className="text-2xl font-semibold tracking-[-0.03em]">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}
