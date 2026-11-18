import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "@/app/providers/app-providers";
import type { SyncStatus } from "@/types/library-sync.types";

import { SyncSettings } from "./sync-settings";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: () => true }));

const OCTOCAT = {
  id: "99999999-2222-4333-8444-555555555555",
  username: "octocat",
  avatarUrl: null,
};
const REPORT = { changed: false, syncedAt: 1_700_000_000_000 };
const GOOD = "correct horse battery";

/** Renders the section with sync starting at `initial`; turning it on or off updates it. */
function renderSync(initial: SyncStatus, signedIn = true) {
  let status = initial;
  vi.mocked(invoke).mockImplementation((command, args) => {
    const passphrase = (args as { passphrase?: string } | undefined)?.passphrase;
    switch (command) {
      case "community_session":
        return Promise.resolve(signedIn ? OCTOCAT : null);
      case "library_sync_status":
        return Promise.resolve(status);
      case "turn_on_library_sync":
        if (passphrase !== GOOD) {
          return Promise.reject(new Error("That passphrase doesn't open your synced library."));
        }
        status = { state: "on", syncedAt: REPORT.syncedAt };
        return Promise.resolve(REPORT);
      case "start_library_sync_over":
        status = { state: "on", syncedAt: REPORT.syncedAt };
        return Promise.resolve(REPORT);
      case "sync_library":
        return Promise.resolve(REPORT);
      case "turn_off_library_sync":
        status = { state: "needsPassphrase" };
        return Promise.resolve(null);
      default:
        return Promise.reject(new Error(`unexpected ${command}`));
    }
  });
  render(
    <AppProviders>
      <SyncSettings />
    </AppProviders>,
  );
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("SyncSettings", () => {
  it("asks to sign in first", async () => {
    renderSync({ state: "signedOut" }, false);

    expect(await screen.findByText(/Sign in with GitHub under Account/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Turn on sync" })).not.toBeInTheDocument();
  });

  it("turns sync on with a passphrase typed twice", async () => {
    renderSync({ state: "off" });
    fireEvent.click(await screen.findByRole("button", { name: "Turn on sync" }));
    const dialog = await screen.findByRole("dialog");

    type("New sync passphrase", "short");
    fireEvent.click(within(dialog).getByRole("button", { name: "Turn on sync" }));
    expect(await within(dialog).findByText("Use at least 10 characters.")).toBeInTheDocument();

    type("New sync passphrase", GOOD);
    type("Repeat the passphrase", "correct horse batterY");
    fireEvent.click(within(dialog).getByRole("button", { name: "Turn on sync" }));
    expect(await within(dialog).findByText("The passphrases don't match.")).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalledWith("turn_on_library_sync", expect.anything());

    type("Repeat the passphrase", GOOD);
    fireEvent.click(within(dialog).getByRole("button", { name: "Turn on sync" }));

    expect(await screen.findByText(/^Sync is on\. Last synced/)).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("turn_on_library_sync", { passphrase: GOOD });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("explains a wrong passphrase and offers to start over", async () => {
    renderSync({ state: "needsPassphrase" });
    fireEvent.click(await screen.findByRole("button", { name: "Enter passphrase" }));
    const dialog = await screen.findByRole("dialog");

    type("Sync passphrase", "not the passphrase");
    fireEvent.click(within(dialog).getByRole("button", { name: "Start syncing" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "That passphrase doesn't open your synced library.",
    );

    fireEvent.click(within(dialog).getByRole("button", { name: "Forgot it? Start over" }));
    expect(within(dialog).getByText("This deletes the synced copy")).toBeInTheDocument();
    type("New sync passphrase", "a brand new passphrase");
    type("Repeat the passphrase", "a brand new passphrase");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete synced copy and start over" }),
    );

    expect(await screen.findByText(/^Sync is on/)).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("start_library_sync_over", {
      passphrase: "a brand new passphrase",
    });
  });

  it("syncs on request and turns off on this computer", async () => {
    renderSync({ state: "on", syncedAt: null });

    fireEvent.click(await screen.findByRole("button", { name: "Sync now" }));
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("sync_library");
    });

    fireEvent.click(screen.getByRole("button", { name: "Turn off on this computer" }));
    expect(await screen.findByRole("button", { name: "Enter passphrase" })).toBeInTheDocument();
  });
});
