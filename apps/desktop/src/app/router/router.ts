import { createBrowserRouter, redirect, type RouteObject } from "react-router";

import { AppLayout } from "@/app/layouts/app-layout";
import { DashboardPage } from "@/features/dashboard";
import { DiscoveryPage } from "@/features/discovery";
import { ExplorerPage } from "@/features/explorer";
import { LibraryPage, ResourceViewerPage } from "@/features/library";
import { NewsPage, NewsViewerPage, RankingsPage } from "@/features/news";
import { CollectionDetailPage, CollectionsPage } from "@/features/organizer";
import { SettingsPage } from "@/features/settings";
import { SnippetsPage } from "@/features/snippets";
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
        handle: { title: "Repos" } satisfies RouteHandle,
      },
      {
        path: "discovery/view",
        Component: NewsViewerPage,
        handle: { title: "Repos" } satisfies RouteHandle,
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
        handle: { title: "Languages" } satisfies RouteHandle,
      },
      {
        path: "collections",
        Component: CollectionsPage,
        handle: { title: "Collections" } satisfies RouteHandle,
      },
      {
        path: "collections/:groupId",
        Component: CollectionDetailPage,
        handle: { title: "Collections" } satisfies RouteHandle,
      },
      {
        path: "explorer",
        Component: ExplorerPage,
        handle: { title: "Explorer" } satisfies RouteHandle,
      },
      {
        path: "explorer/view",
        Component: NewsViewerPage,
        handle: { title: "Explorer" } satisfies RouteHandle,
      },
      {
        path: "snippets",
        Component: SnippetsPage,
        handle: { title: "Snippets" } satisfies RouteHandle,
      },
      {
        path: "settings",
        Component: SettingsPage,
        handle: { title: "Settings" } satisfies RouteHandle,
      },
      // Unknown paths return to the dashboard.
      { path: "*", loader: () => redirect("/") },
    ],
  },
];

export const router = createBrowserRouter(routes);
