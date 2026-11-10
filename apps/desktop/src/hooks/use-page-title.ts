import { useMatches } from "react-router";

/** Metadata attached to routes through React Router's `handle`. */
export interface RouteHandle {
  title: string;
}

function isRouteHandle(handle: unknown): handle is RouteHandle {
  return (
    typeof handle === "object" &&
    handle !== null &&
    "title" in handle &&
    typeof handle.title === "string"
  );
}

/** Title of the deepest matched route that declares one. */
export function usePageTitle(): string {
  const handle = useMatches()
    .map((match) => match.handle)
    .findLast(isRouteHandle);
  return handle?.title ?? "DevAtlas";
}
