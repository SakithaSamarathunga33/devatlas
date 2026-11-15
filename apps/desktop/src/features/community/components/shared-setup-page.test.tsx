import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "@/app/providers/app-providers";
import type { SharedSetup } from "@/types/agent-setups.types";
import type { CommunityUser } from "@/types/community.types";

import { LIBRARY, OWNER_ID, USER } from "./community.test-data";
import { SETUP } from "./setup.test-data";
import { SharedSetupPage } from "./shared-setup-page";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: () => true }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(() => Promise.resolve()) }));

function renderPage(session: CommunityUser, setup: SharedSetup | null = SETUP) {
  vi.mocked(invoke).mockReset();
  vi.mocked(invoke).mockImplementation((command) => {
    switch (command) {
      case "community_session":
        return Promise.resolve(session);
      case "get_shared_setup":
        return Promise.resolve(setup);
      case "list_library":
        return Promise.resolve(LIBRARY);
      case "report_shared_setup":
        return Promise.resolve(true);
      default:
        return Promise.resolve({ title: null, image: null, icon: null });
    }
  });
  render(
    <AppProviders>
      <MemoryRouter initialEntries={[`/community/setups/${OWNER_ID}`]}>
        <Routes>
          <Route path="/community/setups/:ownerId" element={<SharedSetupPage />} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe("Shared agent setup", () => {
  it("lists items by kind with the exact install commands, and copies one", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    renderPage(USER);

    expect(
      await screen.findByRole("heading", { level: 1, name: "octocat's agent setup" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Skills (1)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "MCP servers (1)" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "claude mcp add -s user github -- npx -y @modelcontextprotocol/server-github",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copy the Codex command for github" }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        "codex mcp add github -- npx -y @modelcontextprotocol/server-github",
      );
    });
  });

  it("lets someone else report it", async () => {
    renderPage(USER);

    fireEvent.click(await screen.findByRole("button", { name: "Report" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Report" }));
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("report_shared_setup", {
        ownerId: OWNER_ID,
        reason: null,
      });
    });
  });

  it("shows its owner Update and Unshare instead of Report", async () => {
    renderPage({ ...USER, id: OWNER_ID });

    expect(await screen.findByRole("button", { name: "Update" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unshare" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Report" })).not.toBeInTheDocument();
  });

  it("says so when the setup isn't shared any more", async () => {
    renderPage(USER, null);

    expect(
      await screen.findByRole("heading", { name: "This setup isn't shared any more." }),
    ).toBeInTheDocument();
  });
});
