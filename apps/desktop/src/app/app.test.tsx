import { render, screen, within } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { describe, expect, it, vi } from "vitest";

import { App } from "@/app/app";
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

function mockBackend(appInfo: () => Promise<unknown>) {
  invokeMock.mockImplementation((command) => {
    if (command === "get_app_info") return appInfo();
    if (command === "list_library") return Promise.resolve(LIBRARY);
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

  it("shows real library numbers, collections and recent activity", async () => {
    mockBackend(() => Promise.resolve(APP_INFO));

    render(<App />);

    expect(await screen.findByText("Total resources")).toBeInTheDocument();
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
