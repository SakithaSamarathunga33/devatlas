import { render, screen } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "@/app/providers/app-providers";

import { DashboardPage } from "./dashboard-page";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: () => true }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(() => Promise.resolve()) }));

const EMPTY_LIBRARY = { source: { browser: "", folder: "", warning: null }, resources: [] };

function renderDashboard(respond: (command: string) => Promise<unknown>) {
  vi.mocked(invoke).mockImplementation(respond);
  render(
    <AppProviders>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </AppProviders>,
  );
}

describe("DashboardPage", () => {
  it("explains an unreadable library once and keeps the feeds", async () => {
    renderDashboard((command) =>
      command === "list_library"
        ? Promise.reject(new Error("The library is unavailable."))
        : Promise.resolve([]),
    );

    const message = await screen.findByText("The library is unavailable.");
    expect(message.closest('[role="alert"]')).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Top stories" })).toBeInTheDocument();
    expect(screen.getAllByText("Unavailable right now.")).toHaveLength(2);
  });

  it("invites a first save when the library is empty", async () => {
    renderDashboard((command) => Promise.resolve(command === "list_library" ? EMPTY_LIBRARY : []));

    expect(await screen.findByRole("heading", { name: "Your library is empty" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Add a link" })).toHaveAttribute(
      "href",
      "/library?add=1",
    );
    expect(screen.getByText("Save your first link with Add link.")).toBeInTheDocument();
  });

  it("reports feeds that fail without hiding the library", async () => {
    renderDashboard((command) =>
      command === "list_library"
        ? Promise.resolve(EMPTY_LIBRARY)
        : Promise.reject(new Error("command failed: offline")),
    );

    expect(await screen.findByText("Top stories aren't available")).toBeInTheDocument();
    expect(await screen.findByText("Trending repositories aren't available")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your library is empty" })).toBeInTheDocument();
  });
});
