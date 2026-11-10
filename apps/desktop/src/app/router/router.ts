import { createBrowserRouter, redirect, type RouteObject } from "react-router";

import { AppLayout } from "@/app/layouts/app-layout";
import { DashboardPage } from "@/features/dashboard";
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
      // Only the dashboard exists today; unknown paths return to it.
      { path: "*", loader: () => redirect("/") },
    ],
  },
];

export const router = createBrowserRouter(routes);
