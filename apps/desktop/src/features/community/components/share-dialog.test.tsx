import { fireEvent, render, screen, within } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "@/app/providers/app-providers";
import type { CommunityUser, SharePreview } from "@/types/community.types";

import { COLLECTION_ID, PREVIEW, USER } from "./community.test-data";
import { ShareDialog } from "./share-dialog";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: () => true }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(() => Promise.resolve()) }));

function renderDialog(session: CommunityUser | null, preview: SharePreview = PREVIEW) {
  const onClose = vi.fn();
  vi.mocked(invoke).mockReset();
  vi.mocked(invoke).mockImplementation((command) => {
    switch (command) {
      case "community_session":
        return Promise.resolve(session);
      case "preview_group_share":
        return Promise.resolve(preview);
      case "share_group":
        return Promise.resolve(COLLECTION_ID);
      default:
        return Promise.resolve(null);
    }
  });
  render(
    <AppProviders>
      <MemoryRouter>
        <ShareDialog groupId="c1" onClose={onClose} />
      </MemoryRouter>
    </AppProviders>,
  );
  return { onClose };
}

describe("Share to Community", () => {
  it("previews exactly what goes public, then publishes", async () => {
    const { onClose } = renderDialog(USER);
    const dialog = await screen.findByRole("dialog", { name: "Share to Community" });

    expect(await within(dialog).findByText("Client work")).toBeInTheDocument();
    expect(within(dialog).getByText("Anyone can see this")).toBeInTheDocument();
    const links = within(dialog).getByRole("list", { name: "Links that will be shared" });
    expect(links).toHaveTextContent("Motion");
    expect(links).toHaveTextContent("motion.dev");
    expect(
      within(dialog).getByText("2 links aren't https and will be left out."),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Publish" }));

    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("share_group", { groupId: "c1" });
    });
    await vi.waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("updates a collection shared before, or unshares it", async () => {
    renderDialog(USER, { ...PREVIEW, sharedId: COLLECTION_ID });
    const dialog = await screen.findByRole("dialog", { name: "Share to Community" });

    expect(await within(dialog).findByRole("button", { name: "Update" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Unshare" }));

    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("unshare_collection", { id: COLLECTION_ID });
    });
  });

  it("asks to sign in before publishing", async () => {
    renderDialog(null);
    const dialog = await screen.findByRole("dialog", { name: "Share to Community" });

    expect(
      await within(dialog).findByRole("button", { name: "Sign in with GitHub" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Publish" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
