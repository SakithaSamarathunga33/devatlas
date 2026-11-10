import { createBrowserRouter, redirect, type RouteObject } from "react-router";

import { AppLayout } from "@/app/layouts/app-layout";
import { DashboardPage } from "@/features/dashboard";
import { LibraryPage, ResourceViewerPage } from "@/features/library";
import type { RouteHandle } from "@/hooks/use-page-title";

export const routes: RouteObject[] = [
  {
    path: "/",
    Component: AppLayout,
    children: [
      {
        index: true,
        Component: DashboardPage,
        handle: { title: "Dashboard" } satisfies RouteHandle,
      },
      {
        path: "library",
        Component: LibraryPage,
        handle: { title: "Library" } satisfies RouteHandle,
      },
      {
        path: "library/:resourceId",
        Component: ResourceViewerPage,
        handle: { title: "Library" } satisfies RouteHandle,
      },
      // Unknown paths return to the dashboard.
      { path: "*", loader: () => redirect("/") },
    ],
  },
];

export const router = createBrowserRouter(routes);
