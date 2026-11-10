import { fireEvent, render, screen, within } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { App } from "@/app/app";
import { AppProviders } from "@/app/providers/app-providers";
import { routes } from "@/app/router/router";
import { useUiStore } from "@/stores/ui-store";
import type { LibrarySnapshot } from "@/types/library.types";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: () => true,
}));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(() => Promise.resolve(vi.fn())) }));

const invokeMock = vi.mocked(invoke);

const APP_INFO = { name: "DevAtlas", version: "0.1.0", platform: "windows" };
const LIBRARY: LibrarySnapshot = {
  source: { browser: "Brave", folder: "develop" },
  resources: [
    {
      id: "uiverse.io/elements",
      title: "Uiverse",
      url: "https://uiverse.io/elements",
      host: "uiverse.io",
      category: "ui-components",
      folder: "develop/components",
      addedAt: Date.now() - 60_000,
      isNew: true,
      origin: "browser",
    },
  ],
};

const TRENDING = {
  fullName: "tauri-apps/tauri",
  url: "https://github.com/tauri-apps/tauri",
  description: "Build smaller, faster desktop apps.",
  language: "Rust",
  stars: 1234,
  forks: 56,
  ownerAvatar: null,
  createdAt: new Date(Date.now() - 86_400_000).toISOString(),
};

const STORY = {
  title: "Rust 1.92 released",
  url: "https://blog.rust-lang.org/",
  discussionUrl: "https://news.ycombinator.com/item?id=1",
  points: 812,
  comments: 300,
  publishedAt: Date.now() - 3_600_000,
};

function mockBackend(appInfo: () => Promise<unknown>) {
  invokeMock.mockImplementation((command) => {
    if (command === "get_app_info") return appInfo();
    if (command === "list_library") return Promise.resolve(LIBRARY);
    if (command === "list_trending_repos") return Promise.resolve([TRENDING]);
    if (command === "list_top_stories") return Promise.resolve([STORY]);
    return Promise.resolve({ title: null, image: null, icon: null });
  });
}

// Dashboard sections fade in with Motion, which does not animate under jsdom, so these
// tests assert presence rather than visibility.
describe("App", () => {
  it("renders the shell, window controls and backend status", async () => {
    mockBackend(() => Promise.resolve(APP_INFO));

    render(<App />);

    expect(
      screen.getByRole("heading", { level: 1, name: /^Good (morning|afternoon|evening)$/ }),
    ).toBeInTheDocument();
    const primary = screen.getByRole("navigation", { name: "Primary" });
    expect(within(primary).getByRole("button", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("region", { name: "Coming soon" })).toHaveTextContent("Collections");
    expect(screen.getByRole("button", { name: "Minimize" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(await screen.findByText("DevAtlas 0.1.0 · Windows")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Backend connected");
  });

  it("names the icon-only pages when the sidebar is collapsed", () => {
    mockBackend(() => Promise.resolve(APP_INFO));
    useUiStore.setState({ sidebarCollapsed: true });

    try {
      render(<App />);

      const primary = screen.getByRole("navigation", { name: "Primary" });
      expect(within(primary).getByRole("button", { name: "Dashboard" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(within(primary).getByRole("button", { name: "Library" })).not.toHaveAttribute(
        "aria-current",
      );
    } finally {
      useUiStore.setState({ sidebarCollapsed: false });
    }
  });

  it("opens a page from the sidebar without reloading the window", async () => {
    mockBackend(() => Promise.resolve(APP_INFO));
    render(<App />);

    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Primary" })).getByRole("button", {
        name: "News",
      }),
    );

    expect(await screen.findByRole("heading", { level: 1, name: "News" })).toBeInTheDocument();

    // The app's router is a module singleton; return to the dashboard for the next tests.
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Primary" })).getByRole("button", {
        name: "Dashboard",
      }),
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: /^Good (morning|afternoon|evening)$/ }),
    ).toBeInTheDocument();
  });

  it("shows real library numbers, collections and recent activity", async () => {
    mockBackend(() => Promise.resolve(APP_INFO));

    render(<App />);

    const breakdown = await screen.findByRole("region", { name: "1 resource" });
    expect(within(breakdown).getByRole("link", { name: /UI components\s*1/ })).toHaveAttribute(
      "href",
      "/library?filter=ui-components",
    );
    expect(within(breakdown).getByRole("link", { name: "Review 1 new link" })).toHaveAttribute(
      "href",
      "/library?filter=new",
    );
    const trending = await screen.findByRole("list", { name: "Trending this week" });
    expect(within(trending).getByRole("link", { name: /tauri-apps/ })).toHaveAttribute(
      "href",
      "https://github.com/tauri-apps/tauri",
    );
    expect(screen.getByRole("region", { name: "Trending on GitHub" })).toBeInTheDocument();
    const news = await screen.findByRole("list", { name: "Top stories" });
    expect(within(news).getByRole("link", { name: /Rust 1.92 released/ })).toHaveAttribute(
      "href",
      `/news/view?url=${encodeURIComponent("https://blog.rust-lang.org/")}`,
    );
    const order = ["Top stories", "Trending on GitHub", "Featured resources"].map((name) =>
      screen.getByRole("region", { name }),
    );
    // News first, then trending repos, then the user's resources.
    expect(order[0]?.compareDocumentPosition(order[1] as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(order[1]?.compareDocumentPosition(order[2] as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    const collections = await screen.findByRole("region", { name: "Your collections" });
    expect(await within(collections).findByRole("link", { name: /UI components/ })).toHaveAttribute(
      "href",
      "/library?filter=ui-components",
    );
    const activity = screen.getByRole("region", { name: "Recent activity" });
    expect(within(activity).getByRole("link", { name: "Uiverse" })).toBeInTheDocument();
  });

  it("reports an unreachable backend in the status bar", async () => {
    mockBackend(() => Promise.reject(new Error("Command get_app_info not allowed by ACL")));

    render(<App />);

    expect(await screen.findByText("Backend unavailable")).toBeInTheDocument();
  });

  it("opens a news link in the in-app viewer instead of falling back to the dashboard", async () => {
    mockBackend(() => Promise.resolve(APP_INFO));
    const url = "https://blog.rust-lang.org/";
    const router = createMemoryRouter(routes, {
      initialEntries: [
        { pathname: "/news/view", search: `?url=${encodeURIComponent(url)}`, state: { from: "/" } },
      ],
    });

    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    expect(await screen.findByRole("link", { name: "Back to dashboard" })).toBeInTheDocument();
    expect(screen.getByText(url)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/news/view");
    expect(screen.queryByRole("heading", { level: 1, name: /^Good / })).not.toBeInTheDocument();
  });

  it("switches between the dark and light themes and remembers the choice", async () => {
    mockBackend(() => Promise.resolve(APP_INFO));
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Switch to light theme" }));

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement).not.toHaveClass("dark");
    expect(localStorage.getItem("devatlas-theme")).toBe("light");

    fireEvent.click(screen.getByRole("button", { name: "Switch to dark theme" }));

    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("devatlas-theme")).toBe("dark");
  });
});
