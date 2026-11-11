import { fireEvent, render, screen, within } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "@/app/providers/app-providers";
import type { GithubRepo, StarBoards } from "@/types/discovery.types";
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
    categoryOverride: null,
    status: null,
    lastOpenedAt: null,
    linkHealth: null,
    tags: [],
    note: null,
    origin: "browser",
  };
}

/** Tauri and Next.js are saved; GitHub's Trending page is a link, not a repository. */
const LIBRARY: LibrarySnapshot = {
  source: { browser: "Brave", folder: "develop", warning: null },
  resources: [
    resource("github.com/tauri-apps/tauri", TAURI.url, 1_000),
    resource("github.com/vercel/next.js", NEXT.url, 2_000),
    resource("github.com/trending", "https://github.com/trending", 3_000),
  ],
};

function renderDiscovery(
  trending: () => Promise<unknown> = () => Promise.resolve([TAURI, ZED]),
  entry = "/discovery",
  starBoards: () => Promise<unknown> = () => Promise.reject(new Error("no boards")),
  activity: () => Promise<unknown> = () => Promise.reject(new Error("no activity")),
) {
  vi.mocked(invoke).mockImplementation((command, args) => {
    if (command === "list_trending_repos") return trending();
    if (command === "get_star_boards") return starBoards();
    if (command === "get_repo_activity") return activity();
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

    const list = await screen.findByRole("list", { name: "New repositories" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    const tauri = rowOf(/^tauri-apps\s*\/\s*tauri$/);
    expect(within(tauri).getByRole("link", { name: /^tauri-apps\s*\/\s*tauri$/ })).toHaveAttribute(
      "href",
      `/discovery/view?url=${encodeURIComponent("https://github.com/tauri-apps/tauri")}`,
    );
    expect(tauri).toHaveTextContent(/^1/);
    expect(tauri).toHaveTextContent("Rust");
    expect(tauri).toHaveTextContent("1.2Kstars");
    expect(tauri).toHaveTextContent("Created 2 days ago");
    expect(invoke).toHaveBeenCalledWith("list_trending_repos", { period: "week", language: null });
  });

  it("opens repositories inside DevAtlas, from the name and the button", async () => {
    renderDiscovery();
    await screen.findByRole("list", { name: "New repositories" });
    const inApp = `/discovery/view?url=${encodeURIComponent("https://github.com/tauri-apps/tauri")}`;

    expect(screen.getByRole("link", { name: /^tauri-apps\s*\/\s*tauri$/ })).toHaveAttribute(
      "href",
      inApp,
    );
    expect(screen.getByRole("link", { name: "Open tauri-apps/tauri on GitHub" })).toHaveAttribute(
      "href",
      inApp,
    );
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
    await screen.findByRole("list", { name: "New repositories" });
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
    await screen.findByRole("list", { name: "New repositories" });

    fireEvent.change(screen.getByRole("searchbox", { name: "Search new repositories" }), {
      target: { value: "zed" },
    });

    const list = screen.getByRole("list", { name: "New repositories" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(rowOf(/^zed-industries\s*\/\s*zed$/)).toHaveTextContent(/^2/);
  });

  it("filters by period and language", async () => {
    renderDiscovery();
    await screen.findByRole("list", { name: "New repositories" });

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
    expect(alert).toHaveTextContent("New repositories unavailable");
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

describe("DiscoveryPage — Star History", () => {
  const entry = (fullName: string, stars: number) => ({
    fullName,
    stars,
    newStars: null,
    rankChange: null,
  });
  const BOARDS: StarBoards = {
    weekly: [
      { fullName: "morluto/rea", stars: 449_223, newStars: 24_468, rankChange: 5 },
      { fullName: "zed-industries/zed", stars: 9_000, newStars: 7_200, rankChange: null },
      { fullName: "down/repo", stars: 6_000, newStars: 5_000, rankChange: -2 },
      { fullName: "same/repo", stars: 5_000, newStars: 4_000, rankChange: 0 },
    ],
    weeklyPeriod: "Nov 3, 2026 – Nov 9, 2026",
    allTime: [entry("codecrafters-io/build-your-own-x", 561_535)],
    allTimeUpdated: "Nov 10, 2026",
    randomPool: Array.from({ length: 30 }, (_, index) => entry(`pool/repo-${String(index)}`, 12)),
    pyramid: [
      { threshold: 100_000, label: "100K+", count: 141 },
      { threshold: 100, label: "100+", count: 490_021 },
      { threshold: 1, label: "1+", count: 33_109_894 },
    ],
    pyramidUpdated: "Nov 10, 2026",
  };

  function renderBoards(boards: () => Promise<unknown> = () => Promise.resolve(BOARDS)) {
    renderDiscovery(undefined, "/discovery?view=stars", boards);
  }

  it("opens from the section tabs and ranks the week's biggest gainers", async () => {
    renderDiscovery(undefined, "/discovery", () => Promise.resolve(BOARDS));

    fireEvent.click(await screen.findByRole("button", { name: "Star History" }));

    const list = await screen.findByRole("list", { name: "Star History weekly ranking" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
    const first = rowOf(/^morluto\s*\/\s*rea$/);
    expect(first).toHaveTextContent(/^1/);
    expect(first).toHaveTextContent("+24.5K");
    expect(first).toHaveTextContent("449.2K");
    expect(screen.getByText("Nov 3, 2026 – Nov 9, 2026", { exact: false })).toBeInTheDocument();
  });

  it("shows how each repository moved since last week", async () => {
    renderBoards();
    await screen.findByRole("list", { name: "Star History weekly ranking" });

    expect(rowOf(/^morluto\s*\/\s*rea$/)).toHaveTextContent("Up 5");
    expect(rowOf(/^zed-industries\s*\/\s*zed$/)).toHaveTextContent("New to top 20");
    expect(rowOf(/^down\s*\/\s*repo$/)).toHaveTextContent("Down 2");
    expect(rowOf(/^same\s*\/\s*repo$/)).toHaveTextContent("No change");
  });

  it("saves a ranked repository to the library", async () => {
    renderBoards();

    fireEvent.click(
      await screen.findByRole("button", { name: "Save zed-industries/zed to your library" }),
    );

    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("add_link", {
        url: "https://github.com/zed-industries/zed",
      });
    });
  });

  it("switches to the all-time ranking", async () => {
    renderBoards();
    await screen.findByRole("list", { name: "Star History weekly ranking" });

    fireEvent.click(screen.getByRole("button", { name: "All-time" }));

    const list = screen.getByRole("list", { name: "Star History all-time ranking" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(rowOf(/^codecrafters-io\s*\/\s*build-your-own-x$/)).toHaveTextContent("561.5K");
    expect(screen.getByText("Updated Nov 10, 2026", { exact: false })).toBeInTheDocument();
  });

  it("draws 20 random repositories and shuffles them on request", async () => {
    renderBoards();
    await screen.findByRole("list", { name: "Star History weekly ranking" });
    fireEvent.click(screen.getByRole("button", { name: "Random" }));

    const names = () =>
      within(screen.getByRole("list", { name: "Random repositories" }))
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent);
    const before = names();
    expect(before).toHaveLength(20);

    fireEvent.click(screen.getByRole("button", { name: "Shuffle" }));

    expect(names()).toHaveLength(20);
    expect(names()).not.toEqual(before);
  });

  it("searches the whole random pool, not just the current draw", async () => {
    renderBoards();
    await screen.findByRole("list", { name: "Star History weekly ranking" });
    fireEvent.click(screen.getByRole("button", { name: "Random" }));

    for (const index of [0, 29]) {
      fireEvent.change(
        screen.getByRole("searchbox", { name: "Search Star History repositories" }),
        { target: { value: `repo-${String(index)}` } },
      );

      expect(
        within(screen.getByRole("list", { name: "Random repositories" })).getAllByRole("listitem"),
      ).toHaveLength(1);
    }
  });

  it("tells screen readers what the weekly number means", async () => {
    renderBoards();
    await screen.findByRole("list", { name: "Star History weekly ranking" });

    expect(rowOf(/^morluto\s*\/\s*rea$/)).toHaveTextContent("+24.5K new stars this week");
  });

  it("shows the star pyramid without the catch-all tier and hides search", async () => {
    renderBoards();
    await screen.findByRole("list", { name: "Star History weekly ranking" });

    fireEvent.click(screen.getByRole("button", { name: "Pyramid" }));

    const pyramid = screen.getByRole("list", { name: "Repositories by star count" });
    const tiers = within(pyramid).getAllByRole("listitem");
    expect(tiers).toHaveLength(2);
    expect(tiers[0]).toHaveTextContent("100K+");
    expect(tiers[0]).toHaveTextContent("141");
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("searches the ranking while keeping its positions", async () => {
    renderBoards();
    await screen.findByRole("list", { name: "Star History weekly ranking" });

    fireEvent.change(screen.getByRole("searchbox", { name: "Search Star History repositories" }), {
      target: { value: "zed" },
    });

    const list = screen.getByRole("list", { name: "Star History weekly ranking" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(rowOf(/^zed-industries\s*\/\s*zed$/)).toHaveTextContent(/^2/);
  });

  it("credits and links the source", async () => {
    renderBoards();
    await screen.findByRole("list", { name: "Star History weekly ranking" });

    expect(screen.getByRole("link", { name: "star-history.com" })).toHaveAttribute(
      "href",
      "https://www.star-history.com/",
    );
  });

  it("says when the week has no ranking yet", async () => {
    renderBoards(() => Promise.resolve({ ...BOARDS, weekly: [], weeklyPeriod: null }));

    expect(await screen.findByText(/hasn't published this ranking/)).toBeInTheDocument();
  });

  it("explains when the rankings cannot be read", async () => {
    renderBoards(() => Promise.reject(new Error("Star History's rankings couldn't be loaded.")));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Star History rankings unavailable");
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeEnabled();
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

  it("shows each saved repository's latest release and star growth", async () => {
    renderDiscovery(undefined, "/discovery?view=saved", undefined, () =>
      Promise.resolve({
        latestRelease: {
          tag: "v2.0.0",
          name: "Two",
          url: "https://github.com/tauri-apps/tauri/releases/tag/v2.0.0",
          publishedAt: new Date(Date.now() - 2 * DAY_MS).toISOString(),
        },
        starsGained: { count: 120, days: 3 },
      }),
    );

    const row = await vi.waitFor(() => rowOf(/^tauri-apps\s*\/\s*tauri$/));
    const release = await within(row).findByRole("link", { name: /v2\.0\.0/ });
    expect(release).toHaveAttribute(
      "href",
      `/discovery/view?url=${encodeURIComponent("https://github.com/tauri-apps/tauri/releases/tag/v2.0.0")}`,
    );
    expect(row).toHaveTextContent("New release");
    expect(row).toHaveTextContent("2 days ago");
    expect(row).toHaveTextContent("+120 stars in 3 days");
    expect(invoke).toHaveBeenCalledWith("get_repo_activity", { fullName: "tauri-apps/tauri" });
  });

  it("doesn't call an old release new, and shows nothing without activity", async () => {
    renderDiscovery(undefined, "/discovery?view=saved", undefined, () =>
      Promise.resolve({
        latestRelease: {
          tag: "v1.0.0",
          name: null,
          url: "https://github.com/tauri-apps/tauri/releases/tag/v1.0.0",
          publishedAt: new Date(Date.now() - 40 * DAY_MS).toISOString(),
        },
        starsGained: null,
      }),
    );

    const row = await vi.waitFor(() => rowOf(/^tauri-apps\s*\/\s*tauri$/));
    await within(row).findByRole("link", { name: /v1\.0\.0/ });
    expect(row).not.toHaveTextContent("New release");
    expect(row).not.toHaveTextContent("stars in");
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
