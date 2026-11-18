import { render, screen, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "@/app/providers/app-providers";
import type { SyncStatus } from "@/types/library-sync.types";

import { LibrarySyncRunner } from "./library-sync-runner";
import { SyncSettings } from "./sync-settings";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: () => true }));

function renderRunner(status: SyncStatus) {
  vi.mocked(invoke).mockImplementation((command) => {
    if (command === "community_session") return Promise.resolve(null);
    if (command === "library_sync_status") return Promise.resolve(status);
    if (command === "sync_library") return Promise.resolve({ changed: false, syncedAt: 1 });
    return Promise.reject(new Error(`unexpected ${command}`));
  });
  render(
    <AppProviders>
      <LibrarySyncRunner />
      {/* Shows when the status has arrived, so "never" is checked after the runner saw it. */}
      <SyncSettings />
    </AppProviders>,
  );
}

describe("LibrarySyncRunner", () => {
  it("syncs as soon as the app opens when sync is on", async () => {
    renderRunner({ state: "on", syncedAt: null });

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("sync_library");
    });
  });

  it("never syncs while sync is off", async () => {
    renderRunner({ state: "off" });

    expect(await screen.findByRole("button", { name: "Turn on sync" })).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalledWith("sync_library");
  });
});
