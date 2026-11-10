import { fireEvent, render, screen, within } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "@/app/providers/app-providers";
import type { LibrarySnapshot } from "@/types/library.types";

import { LibraryPage } from "./library-page";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: () => true }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(() => Promise.resolve()) }));

const SNAPSHOT: LibrarySnapshot = {
  source: { browser: "Brave", folder: "develop" },
  resources: [
    {
      id: "motion.dev/docs",
      title: "Docs | Motion",
      url: "https://motion.dev/docs",
      host: "motion.dev",
      category: "animation",
      folder: "develop/components",
      addedAt: 1_755_526_400_000,
      isNew: false,
      origin: "browser",
    },
    {
      id: "reactbits.dev/get-started/index",
      title: "React Bits - Index",
      url: "https://reactbits.dev/get-started/index",
      host: "reactbits.dev",
      category: "ui-components",
      folder: "develop/components",
      addedAt: null,
      isNew: true,
      origin: "browser",
    },
    {
      id: "uiverse.io/elements",
      title: "4508 UI elements: CSS & Tailwind",
      url: "https://uiverse.io/elements",
      host: "uiverse.io",
      category: "ui-components",
      folder: "develop/components",
      addedAt: null,
      isNew: false,
      origin: "browser",
    },
  ],
};

const AWWWARDS = {
  id: "awwwards.com/websites/portfolio",
  title: "Best Portfolio Websites",
  url: "https://www.awwwards.com/websites/portfolio/",
  host: "awwwards.com",
  category: "inspiration",
  folder: "",
  addedAt: 1_762_000_000_000,
  origin: "devatlas",
} as const;

async function renderLibrary(
  snapshot: LibrarySnapshot = SNAPSHOT,
  addLink: () => Promise<unknown> = () => Promise.resolve(AWWWARDS),
) {
  vi.mocked(invoke).mockImplementation((command, args) => {
    if (command === "list_library") return Promise.resolve(snapshot);
    if (command === "add_link") return addLink();
    if (command === "remove_link") return Promise.resolve(true);
    const { url } = args as { url: string };
    return Promise.resolve({ title: null, image: `${url}/og.png`, icon: null });
  });
  const view = render(
    <AppProviders>
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>
    </AppProviders>,
  );
  await screen.findByRole("region", { name: "UI components" });
  return view;
}

function submitLink(url: string) {
  fireEvent.click(screen.getByRole("button", { name: "Add link" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Link to save" }), {
    target: { value: url },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save link" }));
}

describe("LibraryPage", () => {
  it("saves a pasted link and refreshes the library", async () => {
    await renderLibrary();
    vi.mocked(invoke).mockClear();

    submitLink("https://www.awwwards.com/websites/portfolio/");

    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("add_link", {
        url: "https://www.awwwards.com/websites/portfolio/",
      });
      expect(invoke).toHaveBeenCalledWith("list_library");
    });
    expect(screen.getByRole("textbox", { name: "Link to save" })).toHaveValue("");
  });

  it("explains why a link could not be added", async () => {
    await renderLibrary(SNAPSHOT, () =>
      Promise.reject(new Error("“Docs | Motion” is already in your library.")),
    );

    submitLink("motion.dev/docs");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "“Docs | Motion” is already in your library.",
    );
  });

  it("asks for a link before submitting", async () => {
    await renderLibrary();

    expect(screen.queryByRole("textbox", { name: "Link to save" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add link" }));
    expect(screen.getByRole("button", { name: "Add link" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Save link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Paste a link to save it.");
    expect(invoke).not.toHaveBeenCalledWith("add_link", expect.anything());
  });

  it("lets you remove any resource, including Brave bookmarks", async () => {
    await renderLibrary({
      ...SNAPSHOT,
      resources: [...SNAPSHOT.resources, { ...AWWWARDS, isNew: true }],
    });

    expect(screen.getAllByRole("button", { name: /^Remove / })).toHaveLength(4);
    expect(screen.getByText(/and 1 added in DevAtlas/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove Docs | Motion from your library" }));

    expect(await screen.findByText("Removed “Docs | Motion”")).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("remove_link", { id: "motion.dev/docs" });
  });

  it("groups resources from Brave under their categories", async () => {
    await renderLibrary();

    expect(screen.getByText(/3 developer resources: 3 from Brave › develop/)).toBeInTheDocument();
    const components = screen.getByRole("region", { name: "UI components" });
    expect(within(components).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("region", { name: "Animation" })).toHaveTextContent("Docs | Motion");
    expect(invoke).toHaveBeenCalledWith("list_library");
  });

  it("shows each site's preview image fetched by the backend", async () => {
    const { container } = await renderLibrary();

    await vi.waitFor(() => {
      expect(container.querySelector('img[src="https://motion.dev/docs/og.png"]')).not.toBeNull();
    });
    expect(invoke).toHaveBeenCalledWith("get_resource_preview", {
      url: "https://motion.dev/docs",
    });
  });

  it("tags newly added resources, lists them first, and filters to them", async () => {
    await renderLibrary();

    expect(
      within(screen.getByRole("link", { name: /React Bits - Index/ })).getByText("New"),
    ).toBeInTheDocument();
    const components = screen.getByRole("region", { name: "UI components" });
    expect(
      within(components)
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(["React Bits - Index", "4508 UI elements: CSS & Tailwind"]);

    fireEvent.click(screen.getByRole("button", { name: /^New/ }));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("filters by category and by search text", async () => {
    await renderLibrary();

    fireEvent.click(screen.getByRole("button", { name: /^Animation/ }));
    expect(screen.queryByRole("region", { name: "UI components" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Animation/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: /^All/ }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search library" }), {
      target: { value: "uiverse" },
    });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("uiverse.io")).toBeInTheDocument();
  });

  it("switches between the grid and a compact list", async () => {
    await renderLibrary();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "List view" }));

    expect(screen.getByRole("button", { name: "List view" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Docs \| Motion/ })).toHaveAttribute(
      "href",
      "/library/motion.dev%2Fdocs",
    );
    expect(screen.getAllByRole("button", { name: /^Remove / })).toHaveLength(3);
  });

  it("opens resources inside DevAtlas, with the browser as an explicit option", async () => {
    await renderLibrary();

    expect(screen.getByRole("link", { name: /React Bits - Index/ })).toHaveAttribute(
      "href",
      "/library/reactbits.dev%2Fget-started%2Findex",
    );

    fireEvent.click(screen.getByRole("button", { name: "Open reactbits.dev in your browser" }));
    expect(openUrl).toHaveBeenCalledWith("https://reactbits.dev/get-started/index");
  });
});
