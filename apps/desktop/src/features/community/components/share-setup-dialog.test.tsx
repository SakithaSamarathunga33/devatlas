import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "@/app/providers/app-providers";
import type { SharedSetup } from "@/types/agent-setups.types";

import { USER } from "./community.test-data";
import { DETECTED, HALLMARK, SETUP } from "./setup.test-data";
import { ShareSetupDialog } from "./share-setup-dialog";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: () => true }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(() => Promise.resolve()) }));

function renderDialog(shared: SharedSetup | null | "pending") {
  const onClose = vi.fn();
  vi.mocked(invoke).mockReset();
  vi.mocked(invoke).mockImplementation((command) => {
    switch (command) {
      case "community_session":
        return Promise.resolve(USER);
      case "detect_agent_setup":
        return Promise.resolve(DETECTED);
      case "get_shared_setup":
        return shared === "pending" ? new Promise(() => undefined) : Promise.resolve(shared);
      default:
        return Promise.resolve(null);
    }
  });
  render(
    <AppProviders>
      <MemoryRouter>
        <ShareSetupDialog onClose={onClose} />
      </MemoryRouter>
    </AppProviders>,
  );
  return onClose;
}

describe("Share your agent setup", () => {
  it("won't publish until the setup shared before has loaded", async () => {
    renderDialog("pending");

    expect(await screen.findByRole("button", { name: "Share 0" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("ticks nothing until asked, then shares the chosen keys", async () => {
    const onClose = renderDialog(null);

    expect(await screen.findByRole("checkbox", { name: /hallmark/ })).not.toBeChecked();
    expect(screen.getByText(/private repository or package/)).toBeInTheDocument();
    expect(screen.getByText(/never leave this computer/)).toBeInTheDocument();
    expect(screen.getByText(/1 left out/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share 0" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Tick everything with a public source" }));
    expect(screen.getByRole("checkbox", { name: /hallmark/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /^github/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /private-db/ })).not.toBeChecked();

    fireEvent.click(screen.getByRole("checkbox", { name: /hallmark/ }));
    fireEvent.click(screen.getByRole("button", { name: "Share 1" }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("share_agent_setup", {
        keys: ["mcp-server:github"],
        description: null,
      });
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("starts from what was shared before and can unshare it", async () => {
    renderDialog({ ...SETUP, items: [HALLMARK] });

    expect(await screen.findByRole("checkbox", { name: /hallmark/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /^github/ })).not.toBeChecked();
    expect(screen.getByRole("textbox", { name: /About your setup/ })).toHaveValue(
      "What I run every day",
    );

    fireEvent.click(screen.getByRole("button", { name: "Unshare" }));
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("unshare_agent_setup");
    });
  });
});
