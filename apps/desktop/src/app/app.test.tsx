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
      addedAt: null,
      isNew: false,
    },
  ],
};

function mockBackend(appInfo: () => Promise<unknown>) {
  invokeMock.mockImplementation((command) =>
    command === "get_app_info" ? appInfo() : Promise.resolve(LIBRARY),
  );
}

// Dashboard sections fade in with Motion, which does not animate under jsdom, so these
// tests assert presence rather than visibility.
describe("App", () => {
  it("renders the shell with app information from the Rust backend", async () => {
    mockBackend(() => Promise.resolve(APP_INFO));

    render(<App />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Welcome to DevAtlas" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(await screen.findByText("0.1.0")).toBeInTheDocument();
    expect(screen.getByText("Windows")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Backend connected");
    expect(invokeMock).toHaveBeenCalledWith("get_app_info");
  });

  it("summarizes the Brave library on the dashboard", async () => {
    mockBackend(() => Promise.resolve(APP_INFO));

    render(<App />);

    const summary = await screen.findByRole("region", { name: "Your library" });
    expect(await within(summary).findByText("UI components")).toBeInTheDocument();
    expect(within(summary).getByText("Read live from Brave › develop")).toBeInTheDocument();
    expect(within(summary).getByRole("link", { name: "Open library" })).toHaveAttribute(
      "href",
      "/library",
    );
  });

  it("shows an actionable error when the backend command fails", async () => {
    mockBackend(() => Promise.reject(new Error("Command get_app_info not allowed by ACL")));

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Command get_app_info not allowed by ACL",
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("Backend unavailable");
  });

  it("lists planned modules as a roadmap, not as working features", () => {
    mockBackend(() => Promise.resolve(APP_INFO));

    render(<App />);

    const roadmap = screen.getByRole("region", { name: "What's on the way" });
    const items = within(roadmap).getAllByRole("listitem");
    expect(items.map((item) => within(item).getByRole("heading").textContent)).toEqual([
      "Collections",
      "Explorer",
      "Discovery",
      "Projects",
    ]);
    expect(within(roadmap).getAllByText("Planned")).toHaveLength(4);
  });
});
