import { render, screen, within } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { describe, expect, it, vi } from "vitest";

import { App } from "@/app/app";
import { useUiStore } from "@/stores/ui-store";
import type { LibrarySnapshot } from "@/types/library.types";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: () => true,
}));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

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

function mockBackend(appInfo: () => Promise<unknown>) {
  invokeMock.mockImplementation((command) => {
    if (command === "get_app_info") return appInfo();
    if (command === "list_library") return Promise.resolve(LIBRARY);
    if (command === "list_trending_repos") return Promise.resolve([TRENDING]);
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
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Minimize" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(await screen.findByText("DevAtlas 0.1.0 · Windows")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Backend connected");
  });

  it("keeps the navigation links styled when the sidebar is collapsed", () => {
    mockBackend(() => Promise.resolve(APP_INFO));
    useUiStore.setState({ sidebarCollapsed: true });

    try {
      render(<App />);

      // Collapsed links sit inside a Radix tooltip trigger, which merges class names as
      // strings; a function className used to arrive as its source text.
      for (const name of ["Dashboard", "Library"]) {
        const link = screen.getByRole("link", { name });
        expect(link).toHaveClass("h-10");
        expect(link.className).not.toContain("=>");
      }
      expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    } finally {
      useUiStore.setState({ sidebarCollapsed: false });
    }
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
});
