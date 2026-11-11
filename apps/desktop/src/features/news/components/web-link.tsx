import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";

import { cn } from "@/lib/utils";

import { newsViewerPath } from "../news-links";

/** A news link that opens inside DevAtlas, like library sites; the viewer's back button
 * returns to the page the link was on. */
export function WebLink({
  href,
  title,
  className,
  children,
}: {
  href: string;
  /** The tooltip; defaults to the address. */
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  const location = useLocation();
  return (
    <Link
      to={newsViewerPath(href)}
      state={{ from: `${location.pathname}${location.search}` }}
      title={title ?? href}
      className={cn(
        "rounded outline-none hover:underline hover:underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {children}
    </Link>
  );
}
