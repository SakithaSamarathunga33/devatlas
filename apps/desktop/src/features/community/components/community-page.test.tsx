import { fireEvent, render, screen } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "@/app/providers/app-providers";
import type { CommunityUser } from "@/types/community.types";

import { summary, USER } from "./community.test-data";
import { CommunityPage } from "./community-page";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: () => true }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(() => Promise.resolve()) }));

function renderPage(session: CommunityUser | null = USER) {
  vi.mocked(invoke).mockReset();
  vi.mocked(invoke).mockImplementation((command, args) => {
    if (command === "community_session") return Promise.resolve(session);
    if (command === "list_shared_collections") {
      const { query, offset } = args as { query: string | null; offset: number };
      if (offset > 0) {
        return Promise.resolve({
          collections: [summary({ id: "x3", title: "Older picks" })],
          nextOffset: null,
        });
      }
      const collections =
        query === "nothing" ? [] : [summary(), summary({ id: "x2", title: "Design inspiration" })];
      return Promise.resolve({ collections, nextOffset: query === null ? 30 : null });
    }
    if (command === "community_sign_in") return new Promise(() => undefined);
    return Promise.resolve(null);
  });
  render(
    <AppProviders>
      <MemoryRouter>
        <CommunityPage />
      </MemoryRouter>
    </AppProviders>,
  );
}

describe("Community", () => {
  it("lists published collections, linking to each", async () => {
    renderPage();

    const link = await screen.findByRole("link", {
      name: /Rust tools, by octocat, 2 links, 12 followers/,
    });
    expect(link).toHaveAttribute("href", `/community/${summary().id}`);
    expect(link.closest("li")).toHaveTextContent("Crates worth knowing");
    expect(screen.getByRole("link", { name: /Design inspiration/ })).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("list_shared_collections", { query: null, offset: 0 });
  });

  it("loads the next page on request", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Load more" }));

    expect(await screen.findByRole("link", { name: /Older picks/ })).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("list_shared_collections", { query: null, offset: 30 });
    expect(screen.getByRole("link", { name: /Rust tools/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("searches after typing stops", async () => {
    renderPage();
    await screen.findByRole("link", { name: /Rust tools/ });

    fireEvent.change(screen.getByRole("searchbox", { name: "Search Community collections" }), {
      target: { value: "nothing" },
    });

    expect(await screen.findByText("No collections match “nothing”")).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("list_shared_collections", {
      query: "nothing",
      offset: 0,
    });
  });

  it("asks to sign in instead of showing collections when signed out", async () => {
    renderPage(null);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Sign in to browse Community" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Rust tools/ })).not.toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalledWith("list_shared_collections", expect.anything());
    // The panel's button is the only sign-in; the header no longer repeats it.
    expect(screen.getAllByRole("button", { name: "Sign in with GitHub" })).toHaveLength(1);
  });

  it("signs in from the panel, with a way to cancel", async () => {
    renderPage(null);

    fireEvent.click(await screen.findByRole("button", { name: "Sign in with GitHub" }));

    expect(await screen.findByText(/Unsupported provider/)).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("community_sign_in");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(invoke).toHaveBeenCalledWith("community_cancel_sign_in");
    expect(await screen.findByRole("button", { name: "Sign in with GitHub" })).toBeInTheDocument();
  });

  it("shows the collections once signing in succeeds", async () => {
    renderPage(null);
    vi.mocked(invoke).mockImplementation((command) => {
      if (command === "community_sign_in") return Promise.resolve(USER);
      if (command === "list_shared_collections") {
        return Promise.resolve({ collections: [summary()], nextOffset: null });
      }
      return Promise.resolve(null);
    });

    fireEvent.click(await screen.findByRole("button", { name: "Sign in with GitHub" }));

    expect(await screen.findByRole("link", { name: /Rust tools/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });

  it("explains a failed sign-in", async () => {
    renderPage(null);
    vi.mocked(invoke).mockImplementation((command) =>
      command === "community_sign_in"
        ? Promise.reject(new Error("GitHub sign-in isn't enabled yet."))
        : Promise.resolve(null),
    );

    fireEvent.click(await screen.findByRole("button", { name: "Sign in with GitHub" }));

    const message = await screen.findByText("GitHub sign-in isn't enabled yet.");
    expect(message.closest('[role="alert"]')).toBeInTheDocument();
  });

  it("shows the signed-in account and its own collections", async () => {
    renderPage({ id: summary().owner.id, username: "octocat", avatarUrl: null });

    expect(await screen.findByRole("button", { name: /Shared by you/ })).toBeInTheDocument();
    // The account and Sign out are in the sidebar, not repeated in the page header.
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in with GitHub" })).not.toBeInTheDocument();
  });
});
