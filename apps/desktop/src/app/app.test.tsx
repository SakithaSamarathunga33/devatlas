import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { App } from "@/app/app";
import { AppProviders } from "@/app/providers/app-providers";
import { routes } from "@/app/router/router";
import { useUiStore } from "@/stores/ui-store";
import type { LibrarySnapshot } from "@/types/library.types";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: () => true,
}));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(() => Promise.resolve()) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(() => Promise.resolve(vi.fn())) }));

const invokeMock = vi.mocked(invoke);

const APP_INFO = { name: "DevAtlas", version: "0.1.0", platform: "windows" };
const LIBRARY: LibrarySnapshot = {
  source: { browser: "Brave", folder: "develop", warning: null },
  resources: [
    {
      id: "uiverse.io/elements",
      title: "Uiverse",
      url: "https://uiverse.io/elements",
      host: "uiverse.io",
      category: "ui-components",
      folder: "develop/components",
      addedAt: Date.now() - 60_000,
      isNew: true,
      categoryOverride: null,
      status: null,
      lastOpenedAt: null,
      linkHealth: null,
      tags: [],
      note: null,
      origin: "browser",
    },
  ],
};

const TRENDING = {
  fullName: "tauri-apps/tauri",
  url: "https://github.com/tauri-apps/tauri",
  description: "Build smaller, faster desktop apps.",
  language: "Rust",
  stars: 1234,
  forks: 56,
  ownerAvatar: null,
  createdAt: new Date(Date.now() - 86_400_000).toISOString(),
};

const STORY = {
  title: "Rust 1.92 released",
  url: "https://blog.rust-lang.org/",
  discussionUrl: "https://news.ycombinator.com/item?id=1",
  points: 812,
  comments: 300,
  publishedAt: Date.now() - 3_600_000,
};

const RELEASE = {
  tag: "v0.1.0-build.24",
  name: "DevAtlas v0.1.0-build.24",
  url: "https://github.com/owner/devatlas/releases/tag/v0.1.0-build.24",
  publishedAt: "2026-11-14T10:00:00Z",
};

function mockBackend(
  appInfo: () => Promise<unknown>,
  update: unknown = null,
  install: () => Promise<unknown> = () => Promise.resolve(null),
  isOnboarded = true,
  signIn: () => Promise<unknown> = () => new Promise(() => undefined),
  complete: () => Promise<unknown> = () => Promise.resolve(null),
) {
  invokeMock.mockImplementation((command) => {
    if (command === "get_onboarded") return Promise.resolve(isOnboarded);
    if (command === "community_sign_in") return signIn();
    if (command === "complete_onboarding") return complete();
    if (command === "community_session") return Promise.resolve(null);
    if (command === "community_cancel_sign_in") return Promise.resolve(null);
    if (command === "get_app_info") return appInfo();
    if (command === "check_for_update") return Promise.resolve(update);
    if (command === "install_update") return install();
    if (command === "sync_github_stars") return Promise.resolve(0);
    if (command === "list_library") return Promise.resolve(LIBRARY);
    if (command === "list_trending_repos") return Promise.resolve([TRENDING]);
    if (command === "list_top_stories") return Promise.resolve([STORY]);
    return Promise.resolve({ title: null, image: null, icon: null });
  });
}

/** Renders the app and waits for the shell, which appears once the welcome is known answered. */
async function renderApp() {
  render(<App />);
  return screen.findByRole("navigation", { name: "Primary" });
}

// Dashboard sections fade in with Motion, which does not animate under jsdom, so these
// tests assert presence rather than visibility.
describe("App", () => {
  it("renders the shell and window controls with no status bar", async () => {
    mockBackend(() => Promise.resolve(APP_INFO));

    await renderApp();

    expect(
      screen.getByRole("heading", { level: 1, name: /^Good (morning|afternoon|evening)$/ }),
    ).toBeInTheDocument();
    const primary = screen.getByRole("navigation", { name: "Primary" });
    expect(within(primary).getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByRole("region", { name: "Coming soon" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Minimize" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("check_for_update");
    });
    // The bar said "Connecting to backend" while loading, then "Backend connected".
    expect(screen.queryByText(/backend/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/DevAtlas 0\.1\.0/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Update to/ })).not.toBeInTheDocument();
  });

  it("puts the collapse button above the pages and the update above Settings", async () => {
    mockBackend(() => Promise.resolve(APP_INFO), RELEASE);

    await renderApp();

    const primary = screen.getByRole("navigation", { name: "Primary" });
    const collapse = within(primary).getByRole("button", { name: /collapse/i });
    const dashboard = within(primary).getByRole("link", { name: "Dashboard" });
    const update = await within(primary).findByRole("button", {
      name: "Update to v0.1.0-build.24",
    });
    const settings = within(primary).getByRole("link", { name: "Settings" });
    const isBefore = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(isBefore(collapse, dashboard)).toBe(true);
    expect(isBefore(update, settings)).toBe(true);
  });

  it("offers GitHub sign-in under Settings when signed out", async () => {
    mockBackend(() => Promise.resolve(APP_INFO));

    const primary = await renderApp();

    const signIn = await within(primary).findByRole("button", { name: "Sign in with GitHub" });
    const settings = within(primary).getByRole("link", { name: "Settings" });
    expect(
      settings.compareDocumentPosition(signIn) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(signIn);

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("community_sign_in");
    });
    expect(
      await within(primary).findByRole("button", { name: "Waiting for GitHub… (cancel)" }),
    ).toBeInTheDocument();
  });

  it("shows the signed-in GitHub account under Settings, linking to Settings", async () => {
    mockBackend(() => Promise.resolve(APP_INFO));
    const fallback = invokeMock.getMockImplementation();
    let signedIn = true;
    invokeMock.mockImplementation((command, ...rest) => {
      if (command === "community_sign_out") {
        signedIn = false;
        return Promise.resolve(null);
      }
      if (command === "community_session") {
        return Promise.resolve(
          signedIn
            ? {
                id: "8b0f2c1e-2f35-4c1b-9f43-6a7d2f6c9b10",
                username: "octocat-the-long-name",
                avatarUrl: "https://avatars.githubusercontent.com/u/583231",
              }
            : null,
        );
      }
      return fallback?.(command, ...rest) ?? Promise.resolve(null);
    });

    const primary = await renderApp();

    const account = await within(primary).findByRole("link", { name: "octocat-the-long-name" });
    expect(account).toHaveTextContent("octocat-the-l…");
    expect(account).toHaveAttribute("href", "/settings");
    expect(account.querySelector("img")).toHaveAttribute(
      "src",
      "https://avatars.githubusercontent.com/u/583231",
    );
    expect(within(primary).queryByRole("button", { name: "Sign in with GitHub" })).toBeNull();

    fireEvent.click(within(primary).getByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("community_sign_out");
    });
    expect(
      await within(primary).findByRole("button", { name: "Sign in with GitHub" }),
    ).toBeInTheDocument();
  });

  it("syncs GitHub stars in the background when the app starts", async () => {
    mockBackend(() => Promise.resolve(APP_INFO));

    await renderApp();

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("sync_github_stars");
    });
  });

  it("checks for updates on request and says when DevAtlas is up to date", async () => {
    mockBackend(() => Promise.resolve(APP_INFO));

    await renderApp();
    const primary = screen.getByRole("navigation", { name: "Primary" });
    fireEvent.click(await within(primary).findByRole("button", { name: "Check for updates" }));

    expect(await screen.findByText("DevAtlas is up to date")).toBeInTheDocument();
    expect(
      invokeMock.mock.calls.filter(([command]) => command === "check_for_update"),
    ).toHaveLength(2);
  });

  it("offers the update a manual check finds", async () => {
    mockBackend(() => Promise.resolve(APP_INFO));

    await renderApp();
    const check = await screen.findByRole("button", { name: "Check for updates" });
    mockBackend(() => Promise.resolve(APP_INFO), RELEASE);
    fireEvent.click(check);

    expect(
      await screen.findByRole("button", { name: "Update to v0.1.0-build.24" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check for updates" })).not.toBeInTheDocument();
  });

  it("explains a manual check that fails", async () => {
    mockBackend(() => Promise.resolve(APP_INFO));

    await renderApp();
    const check = await screen.findByRole("button", { name: "Check for updates" });
    invokeMock.mockImplementation((command) =>
      command === "check_for_update"
        ? Promise.reject(new Error("GitHub's request limit was reached."))
        : Promise.resolve(null),
    );
    fireEvent.click(check);

    expect(await screen.findByText("Couldn't check for updates")).toBeInTheDocument();
    expect(screen.getByText(/request limit/)).toBeInTheDocument();
  });

  it("installs a newer release when Update is pressed", async () => {
    mockBackend(
      () => Promise.resolve(APP_INFO),
      RELEASE,
      () => new Promise(() => {}),
    );

    await renderApp();
    fireEvent.click(await screen.findByRole("button", { name: "Update to v0.1.0-build.24" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("install_update");
    });
    expect(await screen.findByRole("button", { name: "Updating…" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("explains a failed update and offers the release page instead", async () => {
    mockBackend(
      () => Promise.resolve(APP_INFO),
      RELEASE,
      () =>
        Promise.reject(new Error("The update's signature didn't match, so it wasn't installed.")),
    );

    await renderApp();
    fireEvent.click(await screen.findByRole("button", { name: "Update to v0.1.0-build.24" }));

    expect(await screen.findByText("Couldn't update DevAtlas")).toBeInTheDocument();
    expect(screen.getByText(/signature didn't match/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open release page" }));
    expect(vi.mocked(openUrl)).toHaveBeenCalledWith(RELEASE.url);
  });

  it("names the icon-only pages when the sidebar is collapsed", async () => {
    mockBackend(() => Promise.resolve(APP_INFO));
    useUiStore.setState({ sidebarCollapsed: true });

    try {
      await renderApp();

      const primary = screen.getByRole("navigation", { name: "Primary" });
      expect(within(primary).getByRole("link", { name: "Dashboard" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(within(primary).getByRole("link", { name: "Library" })).not.toHaveAttribute(
        "aria-current",
      );
    } finally {
      useUiStore.setState({ sidebarCollapsed: false });
    }
  });

  it("opens a page from the sidebar without reloading the window", async () => {
    mockBackend(() => Promise.resolve(APP_INFO));
    await renderApp();

    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Primary" })).getByRole("link", {
        name: "News",
      }),
    );

    expect(await screen.findByRole("heading", { level: 1, name: "News" })).toBeInTheDocument();

    // The app's router is a module singleton; return to the dashboard for the next tests.
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Primary" })).getByRole("link", {
        name: "Dashboard",
      }),
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: /^Good (morning|afternoon|evening)$/ }),
    ).toBeInTheDocument();
  });

  it("doesn't mark a primary page active on Settings, and can return to the dashboard", async () => {
    mockBackend(() => Promise.resolve(APP_INFO));
    await renderApp();

    fireEvent.click(screen.getByRole("link", { name: "Settings" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();

    const dashboard = within(screen.getByRole("navigation", { name: "Primary" })).getByRole(
      "link",
      { name: "Dashboard" },
    );
    expect(dashboard).not.toHaveAttribute("aria-current");

    fireEvent.click(dashboard);
    expect(
      await screen.findByRole("heading", { level: 1, name: /^Good (morning|afternoon|evening)$/ }),
    ).toBeInTheDocument();
  });

  it("shows real library numbers, collections and recent activity", async () => {
    mockBackend(() => Promise.resolve(APP_INFO));

    await renderApp();

    const breakdown = await screen.findByRole("region", { name: "1 resource" });
    expect(within(breakdown).getByRole("link", { name: /UI components\s*1/ })).toHaveAttribute(
      "href",
      "/library?filter=ui-components",
    );
    expect(within(breakdown).getByRole("link", { name: "Review 1 new link" })).toHaveAttribute(
      "href",
      "/library?filter=new",
    );
    const trending = await screen.findByRole("list", { name: "New this week" });
    expect(within(trending).getByRole("link", { name: /tauri-apps/ })).toHaveAttribute(
      "href",
      `/discovery/view?url=${encodeURIComponent("https://github.com/tauri-apps/tauri")}`,
    );
    expect(screen.getByRole("region", { name: "New on GitHub" })).toBeInTheDocument();
    const news = await screen.findByRole("list", { name: "Top stories" });
    expect(within(news).getByRole("link", { name: /Rust 1.92 released/ })).toHaveAttribute(
      "href",
      `/news/view?url=${encodeURIComponent("https://blog.rust-lang.org/")}`,
    );
    expect(screen.getByText(/1 new to review/)).toBeInTheDocument();
    const order = ["Top stories", "New on GitHub", "Latest saves"].map((name) =>
      screen.getByRole("region", { name }),
    );
    // News first, then trending repos, then the user's resources.
    expect(order[0]?.compareDocumentPosition(order[1] as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(order[1]?.compareDocumentPosition(order[2] as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    const collections = await screen.findByRole("region", { name: "Categories" });
    expect(await within(collections).findByRole("link", { name: /UI components/ })).toHaveAttribute(
      "href",
      "/library?filter=ui-components",
    );
    expect(within(collections).queryByRole("img")).not.toBeInTheDocument();
    const latest = screen.getByRole("region", { name: "Latest saves" });
    expect(within(latest).getByRole("link", { name: /Uiverse/ })).toHaveAttribute(
      "href",
      `/library/${encodeURIComponent("uiverse.io/elements")}`,
    );
    expect(screen.queryByRole("region", { name: "Featured resources" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Recent activity" })).not.toBeInTheDocument();
    // The ring only appears while there is something left to review, and says what it measures.
    expect(within(breakdown).getByRole("img", { name: /reviewed/ })).toBeInTheDocument();
  });

  it("opens a news link in the in-app viewer instead of falling back to the dashboard", async () => {
    mockBackend(() => Promise.resolve(APP_INFO));
    const url = "https://blog.rust-lang.org/";
    const router = createMemoryRouter(routes, {
      initialEntries: [
        { pathname: "/news/view", search: `?url=${encodeURIComponent(url)}`, state: { from: "/" } },
      ],
    });

    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    expect(await screen.findByRole("link", { name: "Back to dashboard" })).toBeInTheDocument();
    expect(screen.getByText(url)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/news/view");
    expect(screen.queryByRole("heading", { level: 1, name: /^Good / })).not.toBeInTheDocument();
  });

  it("switches between the dark and light themes and remembers the choice", async () => {
    mockBackend(() => Promise.resolve(APP_INFO));
    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "Switch to light theme" }));

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement).not.toHaveClass("dark");
    expect(localStorage.getItem("devatlas-theme")).toBe("light");

    fireEvent.click(screen.getByRole("button", { name: "Switch to dark theme" }));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("devatlas-theme")).toBe("dark");
  });

  it("opens the saved GitHub repositories from the Library section", async () => {
    mockBackend(() => Promise.resolve(APP_INFO));
    const primary = await renderApp();

    fireEvent.click(within(primary).getByRole("link", { name: "Saved repos" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Saved repos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: "Search saved repositories" }),
    ).toBeInTheDocument();
    expect(within(primary).getByRole("link", { name: "Saved repos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(primary).getByRole("link", { name: "Repos" })).not.toHaveAttribute(
      "aria-current",
    );
    // The router follows the real address bar, which outlives this test.
    fireEvent.click(within(primary).getByRole("link", { name: "Dashboard" }));
  });

  it("groups the pages under titled sections, with Dashboard alone on top", async () => {
    mockBackend(() => Promise.resolve(APP_INFO));
    const primary = await renderApp();

    const sections = {
      Library: ["Library", "Saved repos", "Collections", "Snippets"],
      Discover: ["Explorer", "Repos", "News", "Languages"],
      Community: ["Community"],
    };
    for (const [title, pages] of Object.entries(sections)) {
      const group = within(primary).getByRole("group", { name: title });
      expect(
        within(group)
          .getAllByRole("link")
          .map((link) => link.textContent),
      ).toEqual(pages);
    }
    const dashboard = within(primary).getByRole("link", { name: "Dashboard" });
    const library = within(primary).getByRole("group", { name: "Library" });
    expect(library.contains(dashboard)).toBe(false);
    expect(dashboard.compareDocumentPosition(library) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("welcomes a first launch and remembers choosing to stay local", async () => {
    mockBackend(() => Promise.resolve(APP_INFO), null, undefined, false);
    render(<App />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Welcome to DevAtlas" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with GitHub" })).toHaveFocus();
    expect(screen.getByText(/only needed for Community/)).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Primary" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Use DevAtlas locally" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: /^Good (morning|afternoon|evening)$/ }),
    ).toBeInTheDocument();
    expect(invokeMock).toHaveBeenCalledWith("complete_onboarding");
  });

  it("finishes the welcome once GitHub sign-in succeeds", async () => {
    const user = { id: "99999999-2222-4333-8444-555555555555", username: "me", avatarUrl: null };
    mockBackend(
      () => Promise.resolve(APP_INFO),
      null,
      undefined,
      false,
      () => Promise.resolve(user),
    );
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Continue with GitHub" }));

    expect(await screen.findByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(invokeMock).toHaveBeenCalledWith("community_sign_in");
    expect(invokeMock).toHaveBeenCalledWith("complete_onboarding");
  });

  it("stays on the welcome and explains a sign-in that fails", async () => {
    mockBackend(
      () => Promise.resolve(APP_INFO),
      null,
      undefined,
      false,
      () => Promise.reject(new Error("GitHub sign-in isn't enabled for Community yet.")),
    );
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Continue with GitHub" }));

    expect(
      await screen.findByText("GitHub sign-in isn't enabled for Community yet."),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Welcome to DevAtlas" })).toBeVisible();
    expect(invokeMock).not.toHaveBeenCalledWith("complete_onboarding");
  });

  it("opens the app even when the welcome answer can't be saved, and says so", async () => {
    mockBackend(
      () => Promise.resolve(APP_INFO),
      null,
      undefined,
      false,
      undefined,
      () => Promise.reject(new Error("DevAtlas couldn't save your choice.")),
    );
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Use DevAtlas locally" }));

    expect(await screen.findByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(await screen.findByText("Your choice couldn't be saved")).toBeInTheDocument();
  });

  it("opens the app when the welcome answer can't be read", async () => {
    mockBackend(() => Promise.resolve(APP_INFO));
    const answered = invokeMock.getMockImplementation();
    invokeMock.mockImplementation((command, args) =>
      command === "get_onboarded"
        ? Promise.reject(new Error("unreadable"))
        : (answered?.(command, args) ?? Promise.resolve(null)),
    );

    render(<App />);

    expect(await screen.findByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Welcome to DevAtlas" })).not.toBeInTheDocument();
  });

  it("stops waiting for GitHub when the user chooses to stay local mid sign-in", async () => {
    mockBackend(() => Promise.resolve(APP_INFO), null, undefined, false);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Continue with GitHub" }));
    await screen.findByRole("button", { name: "Cancel" });
    fireEvent.click(screen.getByRole("button", { name: "Use DevAtlas locally" }));

    expect(await screen.findByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(invokeMock).toHaveBeenCalledWith("community_cancel_sign_in");
  });
});
