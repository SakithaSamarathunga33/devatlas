import { fireEvent, render, screen, within } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "@/app/providers/app-providers";
import type { LanguageRanking, NewsFeed, TopStory } from "@/types/news.types";

import { NewsPage } from "./news-page";
import { NewsViewerPage } from "./news-viewer-page";
import { RankingsPage } from "./rankings-page";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: () => true }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(() => Promise.resolve(vi.fn())) }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(() => Promise.resolve()) }));

const HOUR_MS = 3_600_000;
const NOW = Date.now();

const NEWS: NewsFeed = {
  sources: [
    { id: "rust", name: "Rust", category: "language" },
    { id: "swift", name: "Swift", category: "language" },
    { id: "react", name: "React", category: "framework" },
    { id: "postgresql", name: "PostgreSQL", category: "database" },
  ],
  items: [
    {
      sourceId: "postgresql",
      title: "PostgreSQL 19 Beta 1 Released",
      url: "https://www.postgresql.org/about/news/pg19-beta1/",
      publishedAt: NOW - HOUR_MS,
      summary: "The PostgreSQL Global Development Group announces the first beta.",
    },
    {
      sourceId: "rust",
      title: "Announcing Rust 1.95",
      url: "https://blog.rust-lang.org/2026/11/06/Rust-1.95.0/",
      publishedAt: NOW - 2 * HOUR_MS,
      summary: "The Rust team is happy to announce a new version.",
    },
    {
      sourceId: "react",
      title: "React Compiler 2.0",
      url: "https://react.dev/blog/compiler-2",
      publishedAt: NOW - 3 * HOUR_MS,
      summary: null,
    },
  ],
  unavailable: ["swift"],
};

const STORIES: TopStory[] = [
  {
    title: "Show HN: A tiny database in Zig",
    url: "https://example.com/tiny-db",
    discussionUrl: "https://news.ycombinator.com/item?id=50424581",
    points: 321,
    comments: 45,
    publishedAt: NOW - HOUR_MS,
  },
];

const RANKINGS: LanguageRanking[] = [
  {
    index: "tiobe",
    period: "November 2026",
    sourceUrl: "https://www.tiobe.com/tiobe-index/",
    languages: [
      { rank: 1, previousRank: 1, language: "Python", share: 20.86, change: -2.51 },
      { rank: 2, previousRank: 2, language: "C", share: 11.48, change: 1.8 },
      { rank: 3, previousRank: 4, language: "Java", share: 8.89, change: 0.34 },
    ],
  },
  {
    index: "pypl",
    period: "November 2026",
    sourceUrl: "https://pypl.github.io/PYPL.html",
    languages: [{ rank: 1, previousRank: 1, language: "Python", share: 52.04, change: 1.2 }],
  },
];

function viewer(url: string): string {
  return `/news/view?url=${encodeURIComponent(url)}`;
}

function mockBackend() {
  vi.mocked(invoke).mockImplementation((command) => {
    if (command === "list_news") return Promise.resolve(NEWS);
    if (command === "list_top_stories") return Promise.resolve(STORIES);
    if (command === "list_language_rankings") return Promise.resolve(RANKINGS);
    return Promise.reject(new Error(`unexpected command ${command}`));
  });
}

function renderNews() {
  mockBackend();
  render(
    <AppProviders>
      <MemoryRouter initialEntries={["/news"]}>
        <NewsPage />
      </MemoryRouter>
    </AppProviders>,
  );
}

describe("NewsPage", () => {
  it("shows today's top stories above everything else", async () => {
    renderNews();

    expect(screen.getByRole("heading", { level: 1, name: "News" })).toBeInTheDocument();
    const stories = await screen.findByRole("list", { name: "Top stories" });
    // Links open inside DevAtlas, in the news viewer.
    expect(
      within(stories).getByRole("link", { name: /^Show HN: A tiny database in Zig/ }),
    ).toHaveAttribute("href", viewer("https://example.com/tiny-db"));
    expect(within(stories).getByRole("link", { name: /45 comments/ })).toHaveAttribute(
      "href",
      viewer("https://news.ycombinator.com/item?id=50424581"),
    );
    expect(stories).toHaveTextContent("321 points");
  });

  it("groups the latest posts by category, one card per source", async () => {
    renderNews();

    const languages = await screen.findByRole("region", { name: /^Languages/ });
    expect(within(languages).getByRole("heading", { name: "Rust" })).toBeInTheDocument();
    expect(within(languages).getByRole("link", { name: "Announcing Rust 1.95" })).toHaveAttribute(
      "href",
      viewer("https://blog.rust-lang.org/2026/11/06/Rust-1.95.0/"),
    );
    const databases = screen.getByRole("region", { name: /^Databases/ });
    expect(within(databases).getByRole("heading", { name: "PostgreSQL" })).toBeInTheDocument();
    expect(screen.getByText("Couldn't be read right now: Swift.")).toBeInTheDocument();
  });

  it("filters by category, source and search", async () => {
    renderNews();
    await screen.findByRole("region", { name: /^Languages/ });

    const categories = screen.getByRole("group", { name: "Category" });
    fireEvent.click(within(categories).getByRole("button", { name: /^Databases/ }));
    expect(screen.queryByRole("region", { name: /^Languages/ })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: /^Databases/ })).toBeInTheDocument();

    fireEvent.click(within(categories).getByRole("button", { name: /^All/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "Source" }), {
      target: { value: "react" },
    });
    const matching = screen.getByRole("list", { name: "Matching posts" });
    expect(within(matching).getAllByRole("listitem")).toHaveLength(1);
    expect(matching).toHaveTextContent("React Compiler 2.0");

    fireEvent.change(screen.getByRole("combobox", { name: "Source" }), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search blog posts" }), {
      target: { value: "beta" },
    });
    expect(screen.getByRole("list", { name: "Matching posts" })).toHaveTextContent(
      "PostgreSQL 19 Beta 1 Released",
    );
    expect(screen.queryByText("Announcing Rust 1.95")).not.toBeInTheDocument();
  });
});

describe("RankingsPage", () => {
  it("shows the TIOBE and PYPL indexes side by side with movement and attribution", async () => {
    mockBackend();
    render(
      <AppProviders>
        <MemoryRouter initialEntries={["/rankings"]}>
          <RankingsPage />
        </MemoryRouter>
      </AppProviders>,
    );

    const tiobe = await screen.findByRole("list", { name: "TIOBE ranking" });
    const rows = within(tiobe).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows[2]).toHaveTextContent("Java");
    expect(within(tiobe).getByText("up one place since last year")).toBeInTheDocument();
    expect(rows[0]).toHaveTextContent("20.86%");
    expect(screen.getByText(/TIOBE Index, November 2026/)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "PYPL ranking" })).toHaveTextContent("52.04%");
    expect(screen.getByRole("link", { name: "About PYPL" })).toHaveAttribute(
      "href",
      viewer("https://pypl.github.io/PYPL.html"),
    );
  });
});

describe("NewsViewerPage", () => {
  function renderViewer(entry: { pathname: string; search: string; state?: unknown }) {
    mockBackend();
    render(
      <AppProviders>
        <MemoryRouter initialEntries={[entry]}>
          <NewsViewerPage />
        </MemoryRouter>
      </AppProviders>,
    );
  }

  it("refuses links that are not web pages", () => {
    renderViewer({
      pathname: "/news/view",
      search: `?url=${encodeURIComponent("javascript:alert(1)")}`,
    });

    expect(screen.getByText(/Only web pages \(http and https\)/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to news" })).toHaveAttribute("href", "/news");
  });

  it("opens the page in the in-app viewer and returns to where the link was", async () => {
    renderViewer({
      pathname: "/news/view",
      search: `?url=${encodeURIComponent("https://example.com/tiny-db")}`,
      state: { from: "/" },
    });

    expect(screen.getByRole("link", { name: "Back to dashboard" })).toHaveAttribute("href", "/");
    expect(screen.getByText("https://example.com/tiny-db")).toBeInTheDocument();
    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "viewer_open",
        expect.objectContaining({ url: "https://example.com/tiny-db" }),
      );
    });
  });

  it("never returns to an outside address", () => {
    renderViewer({
      pathname: "/news/view",
      search: `?url=${encodeURIComponent("https://example.com/")}`,
      state: { from: "//evil.example" },
    });

    expect(screen.getByRole("link", { name: "Back to news" })).toHaveAttribute("href", "/news");
  });
});
