import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "@/app/providers/app-providers";
import type { SetupEntry, SetupPreview, SharedSetup } from "@/types/agent-setups.types";

import { USER } from "./community.test-data";
import { DETECTED, HALLMARK, SETUP } from "./setup.test-data";
import { ShareSetupDialog } from "./share-setup-dialog";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: () => true }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(() => Promise.resolve()) }));

function renderDialog(shared: SharedSetup | null | "pending", detected: SetupPreview = DETECTED) {
  const onClose = vi.fn();
  vi.mocked(invoke).mockReset();
  vi.mocked(invoke).mockImplementation((command) => {
    switch (command) {
      case "community_session":
        return Promise.resolve(USER);
      case "detect_agent_setup":
        return Promise.resolve(detected);
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

  it("ticks every skill from one repository with its checkbox", async () => {
    const skill = (name: string): SetupEntry => ({
      ...HALLMARK,
      name,
      key: `skill:${name}`,
      source: { type: "github", id: "emilkowalski/skills" },
    });
    renderDialog(null, { items: [skill("animate"), skill("gestures"), HALLMARK], skipped: 0 });

    const repo = await screen.findByRole("checkbox", { name: /^emilkowalski\/skills/ });
    expect(screen.getByText(/2 skills · 0 ticked/)).toBeInTheDocument();
    fireEvent.click(repo);
    expect(repo).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /^hallmark/ })).not.toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Share 2" }));
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("share_agent_setup", {
        keys: ["skill:animate", "skill:gestures"],
        description: null,
      });
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
