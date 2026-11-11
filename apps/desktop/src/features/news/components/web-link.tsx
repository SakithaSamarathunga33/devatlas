import { Link as AstryxLink } from "@astryxdesign/core/Link";
import type { ComponentProps, ReactNode, Ref } from "react";
import { Link, useLocation } from "react-router";

import { newsViewerPath } from "../news-links";

/** Router target for Astryx links into the in-app viewer: remembers the page it was on, so the
 * viewer's back button returns there. */
export function InAppAnchor({
  href,
  ...props
}: Omit<ComponentProps<typeof Link>, "to"> & { href: string }) {
  const location = useLocation();
  return <Link to={href} state={{ from: `${location.pathname}${location.search}` }} {...props} />;
}

/** A news link that opens inside DevAtlas, like library sites. Takes the surrounding text's
 * style unless given a `color`. */
export function WebLink({
  href,
  title,
  className,
  color = "inherit",
  ref,
  children,
}: {
  href: string;
  /** The tooltip; defaults to the address. */
  title?: string;
  className?: string;
  color?: "inherit" | "accent" | "secondary";
  ref?: Ref<HTMLAnchorElement>;
  children: ReactNode;
}) {
  // Astryx's Link forwards `title` to the anchor, though its props don't declare it.
  const tooltip = { title: title ?? href };
  return (
    <AstryxLink
      as={InAppAnchor}
      ref={ref}
      href={newsViewerPath(href)}
      {...tooltip}
      type="inherit"
      color={color}
      className={className}
    >
      {children}
    </AstryxLink>
  );
}
