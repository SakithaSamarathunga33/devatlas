import { createBrowserRouter, redirect, type RouteObject } from "react-router";

import { AppLayout } from "@/app/layouts/app-layout";
import { DashboardPage } from "@/features/dashboard";
import { DiscoveryPage } from "@/features/discovery";
import { LibraryPage, ResourceViewerPage } from "@/features/library";
import { NewsPage, NewsViewerPage, RankingsPage } from "@/features/news";
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
      {
        path: "discovery",
        Component: DiscoveryPage,
        handle: { title: "Discovery" } satisfies RouteHandle,
      },
      {
        path: "news",
        Component: NewsPage,
        handle: { title: "News" } satisfies RouteHandle,
      },
      {
        path: "news/view",
        Component: NewsViewerPage,
        handle: { title: "News" } satisfies RouteHandle,
      },
      {
        path: "rankings",
        Component: RankingsPage,
        handle: { title: "Rankings" } satisfies RouteHandle,
      },
      // Unknown paths return to the dashboard.
      { path: "*", loader: () => redirect("/") },
    ],
  },
];

export const router = createBrowserRouter(routes);
