import { fireEvent, render, screen, within } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "@/app/providers/app-providers";
import type { CommunityUser, SharedCollection } from "@/types/community.types";

import { COLLECTION, COLLECTION_ID, LIBRARY, OWNER_ID, USER } from "./community.test-data";
import { SharedCollectionPage } from "./shared-collection-page";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: () => true }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(() => Promise.resolve()) }));

type Handler = (args: unknown) => Promise<unknown>;

function renderPage(
  session: CommunityUser | null,
  collection: SharedCollection = COLLECTION,
  handlers: Record<string, Handler> = {},
) {
  vi.mocked(invoke).mockReset();
  vi.mocked(invoke).mockImplementation((command, args) => {
    const handler = handlers[command];
    if (handler !== undefined) return handler(args);
    switch (command) {
      case "community_session":
        return Promise.resolve(session);
      case "get_shared_collection":
        return Promise.resolve(collection);
      case "list_library":
        return Promise.resolve(LIBRARY);
      case "add_link":
        return Promise.resolve(LIBRARY.resources[0]);
      case "report_shared_collection":
        return Promise.resolve(true);
      default:
        return Promise.resolve({ title: null, image: null, icon: null });
    }
  });
  render(
    <AppProviders>
      <MemoryRouter initialEntries={[`/community/${COLLECTION_ID}`]}>
        <Routes>
          <Route path="/community/:collectionId" element={<SharedCollectionPage />} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe("Shared collection", () => {
  it("asks to sign in and fetches nothing while signed out", async () => {
    renderPage(null);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Sign in to browse Community" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in with GitHub" })).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalledWith("get_shared_collection", expect.anything());
  });

  it("lists the links, marking the ones already saved", async () => {
    renderPage({ ...USER, id: OWNER_ID });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Rust tools" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Shared by octocat/)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Serde is in your library" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("link", { name: "Tokio" })).toHaveAttribute(
      "href",
      `/news/view?url=${encodeURIComponent("https://tokio.rs/")}`,
    );
    // Nobody reports their own collection.
    expect(screen.queryByRole("button", { name: "Report" })).not.toBeInTheDocument();
  });

  it("never fetches another user's links just because the collection was opened", async () => {
    renderPage(USER);

    expect(await screen.findByRole("link", { name: "Tokio" })).toBeInTheDocument();
    // A preview would request each link's site, telling its owner who looked and when.
    expect(invoke).not.toHaveBeenCalledWith("get_resource_preview", expect.anything());
  });

  it("adds a link to the library", async () => {
    renderPage(USER);

    fireEvent.click(await screen.findByRole("button", { name: "Save Tokio to your library" }));

    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("add_link", { url: "https://tokio.rs/" });
    });
  });

  it("adds every link not saved yet", async () => {
    renderPage(USER);

    fireEvent.click(await screen.findByRole("button", { name: "Add all to library" }));

    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("add_link", { url: "https://tokio.rs/" });
    });
    expect(invoke).not.toHaveBeenCalledWith("add_link", { url: "https://serde.rs/" });
  });

  it("reports with an optional reason when signed in", async () => {
    renderPage(USER);

    fireEvent.click(await screen.findByRole("button", { name: "Report" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Reason (optional)" }), {
      target: { value: "  spam  " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Report" }));

    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("report_shared_collection", {
        id: COLLECTION_ID,
        reason: "spam",
      });
    });
  });

  it("lets the owner unshare instead of report", async () => {
    renderPage({ ...USER, id: OWNER_ID });

    expect(await screen.findByRole("button", { name: "Unshare" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Report" })).not.toBeInTheDocument();
  });

  it("offers to follow, with the follower count", async () => {
    renderPage(USER);

    const follow = await screen.findByRole("button", { name: "Follow, 12 followers" });
    expect(follow).toHaveAttribute("aria-pressed", "false");
    expect(follow).toHaveTextContent("Follow");
  });

  it("follows at once, then shows the server's count", async () => {
    let answer: (state: unknown) => void = () => undefined;
    renderPage(USER, COLLECTION, {
      follow_shared_collection: () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    });

    fireEvent.click(await screen.findByRole("button", { name: "Follow, 12 followers" }));

    const following = await screen.findByRole("button", { name: "Following, 13 followers" });
    expect(following).toHaveAttribute("aria-pressed", "true");
    expect(invoke).toHaveBeenCalledWith("follow_shared_collection", { id: COLLECTION_ID });

    answer({ following: true, followerCount: 14 });

    expect(await screen.findByRole("button", { name: "Following, 14 followers" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("unfollows", async () => {
    renderPage(
      USER,
      { ...COLLECTION, isFollowing: true, followerCount: 1 },
      {
        unfollow_shared_collection: () => Promise.resolve({ following: false, followerCount: 0 }),
      },
    );

    fireEvent.click(await screen.findByRole("button", { name: "Following, 1 follower" }));

    expect(await screen.findByRole("button", { name: "Follow, 0 followers" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(invoke).toHaveBeenCalledWith("unfollow_shared_collection", { id: COLLECTION_ID });
  });

  it("puts the count back and says why when following fails", async () => {
    renderPage(USER, COLLECTION, {
      follow_shared_collection: () =>
        Promise.reject(new Error("Your sign-in has expired. Sign out, then sign in again.")),
    });

    fireEvent.click(await screen.findByRole("button", { name: "Follow, 12 followers" }));

    expect(await screen.findByText("Couldn't follow this collection")).toBeInTheDocument();
    expect(
      screen.getByText("Your sign-in has expired. Sign out, then sign in again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Follow, 12 followers" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("shows the owner the follower count only", async () => {
    renderPage({ ...USER, id: OWNER_ID });

    expect(await screen.findByText("12 followers")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Follow/ })).not.toBeInTheDocument();
  });
});
