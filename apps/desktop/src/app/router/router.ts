import { createBrowserRouter, redirect, type RouteObject } from "react-router";

import { AppLayout } from "@/app/layouts/app-layout";
import { CommunityPage, SharedCollectionPage } from "@/features/community";
import { DashboardPage } from "@/features/dashboard";
import { DiscoveryPage, SavedReposPage } from "@/features/discovery";
import { ExplorerPage } from "@/features/explorer";
import { LibraryPage, ResourceViewerPage } from "@/features/library";
import { NewsPage, NewsViewerPage, RankingsPage } from "@/features/news";
import { CollectionDetailPage, CollectionsPage } from "@/features/organizer";
import { SettingsPage } from "@/features/settings";
import { SnippetsPage } from "@/features/snippets";

export const routes: RouteObject[] = [
  {
    path: "/",
    Component: AppLayout,
    children: [
      {
        index: true,
        Component: DashboardPage,
      },
      {
        path: "library",
        Component: LibraryPage,
      },
      {
        path: "saved-repos",
        Component: SavedReposPage,
      },
      {
        path: "library/:resourceId",
        Component: ResourceViewerPage,
      },
      {
        path: "discovery",
        Component: DiscoveryPage,
      },
      {
        path: "discovery/view",
        Component: NewsViewerPage,
      },
      {
        path: "news",
        Component: NewsPage,
      },
      {
        path: "news/view",
        Component: NewsViewerPage,
      },
      {
        path: "rankings",
        Component: RankingsPage,
      },
      {
        path: "collections",
        Component: CollectionsPage,
      },
      {
        path: "collections/:groupId",
        Component: CollectionDetailPage,
      },
      {
        path: "community",
        Component: CommunityPage,
      },
      {
        path: "community/:collectionId",
        Component: SharedCollectionPage,
      },
      {
        path: "explorer",
        Component: ExplorerPage,
      },
      {
        path: "explorer/view",
        Component: NewsViewerPage,
      },
      {
        path: "snippets",
        Component: SnippetsPage,
      },
      {
        path: "settings",
        Component: SettingsPage,
      },
      // Unknown paths return to the dashboard.
      { path: "*", loader: () => redirect("/") },
    ],
  },
];

export const router = createBrowserRouter(routes);
