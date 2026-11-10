import { fireEvent, render, screen, within } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "@/app/providers/app-providers";
import type { GithubRepo } from "@/types/discovery.types";
import type { LibrarySnapshot, Resource } from "@/types/library.types";

import { DiscoveryPage } from "./discovery-page";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: () => true }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(() => Promise.resolve()) }));

const DAY_MS = 86_400_000;
const TAURI: GithubRepo = {
  fullName: "tauri-apps/tauri",
  url: "https://github.com/tauri-apps/tauri",
  description: "Build smaller, faster, and more secure desktop applications.",
  language: "Rust",
  stars: 1234,
  forks: 56,
  ownerAvatar: "https://avatars.githubusercontent.com/u/54536011",
  createdAt: new Date(Date.now() - 2 * DAY_MS).toISOString(),
};
const ZED: GithubRepo = {
  fullName: "zed-industries/zed",
  url: "https://github.com/zed-industries/zed",
  description: null,
  language: null,
  stars: 87,
  forks: 3,
  ownerAvatar: null,
  createdAt: new Date(Date.now() - DAY_MS).toISOString(),
};
const NEXT: GithubRepo = {
  fullName: "vercel/next.js",
  url: "https://github.com/vercel/next.js",
  description: "The React framework.",
  language: "TypeScript",
  stars: 130_000,
  forks: 28_000,
  ownerAvatar: "https://avatars.githubusercontent.com/u/14985020",
  createdAt: "2016-10-05T23:32:51Z",
};

function resource(id: string, url: string, addedAt: number | null): Resource {
  return {
    id,
    title: id,
    url,
    host: "github.com",
    category: "tools",
    folder: "develop",
    addedAt,
    isNew: false,
    origin: "browser",
  };
}

/** Tauri and Next.js are saved; GitHub's Trending page is a link, not a repository. */
const LIBRARY: LibrarySnapshot = {
  source: { browser: "Brave", folder: "develop" },
  resources: [
    resource("github.com/tauri-apps/tauri", TAURI.url, 1_000),
    resource("github.com/vercel/next.js", NEXT.url, 2_000),
    resource("github.com/trending", "https://github.com/trending", 3_000),
  ],
};

function renderDiscovery(
  trending: () => Promise<unknown> = () => Promise.resolve([TAURI, ZED]),
  entry = "/discovery",
) {
  vi.mocked(invoke).mockImplementation((command, args) => {
    if (command === "list_trending_repos") return trending();
    if (command === "list_library") return Promise.resolve(LIBRARY);
    if (command === "get_github_repo") {
      const { fullName } = args as { fullName: string };
      const repo = [TAURI, NEXT].find((candidate) => candidate.fullName === fullName);
      return repo === undefined ? Promise.reject(new Error("not found")) : Promise.resolve(repo);
    }
    if (command === "add_link") {
      return Promise.resolve({ ...resource("github.com/zed-industries/zed", ZED.url, 4_000) });
    }
    if (command === "remove_link") return Promise.resolve(true);
    return Promise.reject(new Error(`unexpected command ${command}`));
  });
  render(
    <AppProviders>
      <MemoryRouter initialEntries={[entry]}>
        <DiscoveryPage />
      </MemoryRouter>
    </AppProviders>,
  );
}

function rowOf(name: RegExp): HTMLElement {
  const row = screen.getByRole("link", { name }).closest("article");
  if (!(row instanceof HTMLElement)) throw new Error("row not found");
  return row;
}

describe("DiscoveryPage — trending", () => {
  it("ranks this week's most-starred new repositories", async () => {
    renderDiscovery();

    const list = await screen.findByRole("list", { name: "Trending repositories" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    const tauri = rowOf(/^tauri-apps\s*\/\s*tauri$/);
    expect(within(tauri).getByRole("link", { name: /tauri-apps/ })).toHaveAttribute(
      "href",
      "https://github.com/tauri-apps/tauri",
    );
    expect(tauri).toHaveTextContent(/^1/);
    expect(tauri).toHaveTextContent("Rust");
    expect(tauri).toHaveTextContent("1.2Kstars");
    expect(tauri).toHaveTextContent("Created 2 days ago");
    expect(invoke).toHaveBeenCalledWith("list_trending_repos", { period: "week", language: null });
  });

  it("marks repositories already in the library and saves new ones", async () => {
    renderDiscovery();

    expect(
      await screen.findByRole("button", { name: "tauri-apps/tauri is in your library" }),
    ).toBeDisabled();

    fireEvent.click(
      screen.getByRole("button", { name: "Save zed-industries/zed to your library" }),
    );

    expect(
      await screen.findByRole("button", { name: "zed-industries/zed is in your library" }),
    ).toBeDisabled();
    expect(invoke).toHaveBeenCalledWith("add_link", {
      url: "https://github.com/zed-industries/zed",
    });
  });

  it("expands a row when clicked and collapses it on the next click", async () => {
    renderDiscovery();
    await screen.findByRole("list", { name: "Trending repositories" });
    const chart = { name: "Star history chart for tauri-apps/tauri: stars over time" };
    expect(screen.queryByRole("img", chart)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(TAURI.description ?? ""));

    expect(screen.getByRole("img", chart)).toHaveAttribute(
      "src",
      "https://api.star-history.com/svg?repos=tauri-apps%2Ftauri&type=Date&theme=dark",
    );
    expect(
      screen.getByRole("button", { name: "Hide details for tauri-apps/tauri" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Compare on star-history.com" })).toHaveAttribute(
      "href",
      "https://www.star-history.com/?repos=tauri-apps%2Ftauri&type=date&legend=top-left",
    );

    fireEvent.click(screen.getByText(TAURI.description ?? ""));
    expect(screen.queryByRole("img", chart)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show details for zed-industries/zed" }));
    expect(
      screen.getByRole("img", {
        name: "Star history chart for zed-industries/zed: stars over time",
      }),
    ).toBeInTheDocument();
  });

  it("searches the list while keeping GitHub's ranks", async () => {
    renderDiscovery();
    await screen.findByRole("list", { name: "Trending repositories" });

    fireEvent.change(screen.getByRole("searchbox", { name: "Search trending repositories" }), {
      target: { value: "zed" },
    });

    const list = screen.getByRole("list", { name: "Trending repositories" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(rowOf(/^zed-industries\s*\/\s*zed$/)).toHaveTextContent(/^2/);
  });

  it("filters by period and language", async () => {
    renderDiscovery();
    await screen.findByRole("list", { name: "Trending repositories" });

    fireEvent.click(screen.getByRole("button", { name: "This month" }));
    expect(screen.getByRole("button", { name: "This month" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Language" }), {
      target: { value: "Rust" },
    });

    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("list_trending_repos", {
        period: "month",
        language: "Rust",
      });
    });
  });

  it("explains when GitHub cannot be searched", async () => {
    renderDiscovery(() =>
      Promise.reject(new Error("GitHub's request limit was reached. Try again in a few minutes.")),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Trending repositories unavailable");
    expect(alert).toHaveTextContent("GitHub's request limit was reached.");
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeEnabled();
  });

  it("suggests another filter when nothing matches", async () => {
    renderDiscovery(() => Promise.resolve([]));

    expect(
      await screen.findByText(/No new repositories gained stars this week\./),
    ).toBeInTheDocument();
  });
});

describe("DiscoveryPage — saved repositories", () => {
  async function openSaved() {
    renderDiscovery();
    fireEvent.click(await screen.findByRole("button", { name: /^Saved repos/ }));
    return screen.findByRole("region", { name: "Saved repositories" });
  }

  it("shows saved GitHub repositories as cards with details from GitHub", async () => {
    const saved = await openSaved();

    expect(screen.getByRole("button", { name: /^Saved repos\s*2$/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(saved).getByText("2 saved repositories")).toBeInTheDocument();
    expect(await within(saved).findByText("The React framework.")).toBeInTheDocument();
    expect(rowOf(/^vercel\s*\/\s*next\.js$/)).toHaveTextContent("130Kstars");
    expect(within(saved).queryByText(/trending/i)).not.toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("get_github_repo", { fullName: "vercel/next.js" });
  });

  it("filters, sorts, searches and switches to the list view", async () => {
    const saved = await openSaved();
    await within(saved).findByText("The React framework.");
    const names = () =>
      within(saved)
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent);

    // Recently saved first: Next.js (2 000) before Tauri (1 000).
    expect(names()).toEqual(["vercel / next.js", "tauri-apps / tauri"]);

    fireEvent.change(within(saved).getByRole("combobox", { name: "Sort" }), {
      target: { value: "name" },
    });
    expect(names()).toEqual(["tauri-apps / tauri", "vercel / next.js"]);

    fireEvent.change(within(saved).getByRole("combobox", { name: "Language" }), {
      target: { value: "Rust" },
    });
    expect(names()).toEqual(["tauri-apps / tauri"]);
    expect(within(saved).getByText("1 of 2 saved repositories")).toBeInTheDocument();

    fireEvent.change(within(saved).getByRole("combobox", { name: "Language" }), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search saved repositories" }), {
      target: { value: "react" },
    });
    expect(names()).toEqual(["vercel / next.js"]);

    fireEvent.click(within(saved).getByRole("button", { name: "List view" }));
    expect(
      within(saved).getByRole("button", { name: "Show details for vercel/next.js" }),
    ).toBeInTheDocument();
  });

  it("removes a saved repository from the library", async () => {
    const saved = await openSaved();

    fireEvent.click(
      await within(saved).findByRole("button", { name: "Remove vercel/next.js from your library" }),
    );

    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("remove_link", { id: "github.com/vercel/next.js" });
    });
  });
});
