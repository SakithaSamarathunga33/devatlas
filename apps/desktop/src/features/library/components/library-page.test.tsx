import { fireEvent, render, screen, within } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "@/app/providers/app-providers";
import type { LibrarySnapshot } from "@/types/library.types";
import type { Group } from "@/types/organizer.types";

import { LibraryPage } from "./library-page";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: () => true }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(() => Promise.resolve()) }));

const SNAPSHOT: LibrarySnapshot = {
  source: { browser: "Brave", folder: "develop", warning: null },
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
      categoryOverride: null,
      status: null,
      lastOpenedAt: null,
      linkHealth: null,
      tags: [],
      note: null,
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
      categoryOverride: null,
      status: null,
      lastOpenedAt: null,
      linkHealth: null,
      tags: [],
      note: null,
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

const GROUPS: Group[] = [
  {
    id: "c1",
    name: "Client work",
    description: null,
    resourceIds: [],
    createdAt: 1,
  },
  {
    id: "p1",
    name: "Website",
    description: null,
    resourceIds: ["motion.dev/docs"],
    createdAt: 2,
  },
];

async function renderLibrary(
  snapshot: LibrarySnapshot = SNAPSHOT,
  addLink: () => Promise<unknown> = () => Promise.resolve(AWWWARDS),
) {
  vi.mocked(invoke).mockImplementation((command, args) => {
    if (command === "list_library") return Promise.resolve(snapshot);
    if (command === "add_link") return addLink();
    if (command === "remove_link") return Promise.resolve(true);
    if (command === "list_groups") return Promise.resolve(GROUPS);
    if (command === "update_resource") return Promise.resolve(null);
    if (command === "mark_resource_opened") return Promise.resolve(null);
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
  if (snapshot.resources.some((resource) => resource.category === "ui-components")) {
    await screen.findByRole("region", { name: "UI components" });
  }
  return view;
}

function submitLink(url: string) {
  fireEvent.click(screen.getByRole("button", { name: "Add link" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Link to save" }), {
    target: { value: url },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save link" }));
}

/** Theme keeps empty live regions with the alert role, so find the one that says this. */
function findAlert(text: string) {
  return vi.waitFor(() => {
    const alert = screen.getAllByRole("alert").find((node) => node.textContent.includes(text));
    if (alert === undefined) throw new Error(`No alert says “${text}”`);
    return alert;
  });
}

/** Picks an option from an Astryx Selector, whose list opens from a button-like combobox. */
function choose(dialog: HTMLElement, name: RegExp, option: string) {
  fireEvent.click(within(dialog).getByRole("combobox", { name }));
  fireEvent.click(screen.getByRole("option", { name: option }));
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

    expect(await findAlert("“Docs | Motion” is already in your library.")).toBeInTheDocument();
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

    expect(await findAlert("Paste a link to save it.")).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalledWith("add_link", expect.anything());
  });

  it("lets you remove any resource, including Brave bookmarks", async () => {
    await renderLibrary({
      ...SNAPSHOT,
      resources: [
        ...SNAPSHOT.resources,
        {
          ...AWWWARDS,
          isNew: true,
          categoryOverride: null,
          status: null,
          tags: [],
          note: null,
          lastOpenedAt: null,
          linkHealth: null,
        },
      ],
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

    // The card's link is an empty overlay anchor: its name says New, the card shows it.
    expect(screen.getByRole("link", { name: /React Bits - Index.*New/ })).toBeInTheDocument();
    const components = screen.getByRole("region", { name: "UI components" });
    const [firstCard] = within(components).getAllByRole("listitem");
    if (firstCard === undefined) throw new Error("fixture");
    expect(within(firstCard).getByText("New")).toBeInTheDocument();
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
      "aria-current",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: /^All/ }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search library" }), {
      target: { value: "uiverse" },
    });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("uiverse.io")).toBeInTheDocument();
  });

  it("edits a link's category, tags, note and groups", async () => {
    await renderLibrary();

    fireEvent.click(screen.getByRole("button", { name: "Edit Docs | Motion" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit link" });
    expect(await within(dialog).findByRole("checkbox", { name: "Website" })).toBeChecked();
    expect(within(dialog).getByRole("combobox", { name: /^Category/ })).toHaveTextContent(
      "Automatic",
    );
    choose(dialog, /^Category/, "Icons");
    choose(dialog, /^Status/, "Trying");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Tags" }), {
      target: { value: "React, css , " },
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Why it.s here/ }), {
      target: { value: "Good docs" },
    });
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Client work" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("update_resource", {
        id: "motion.dev/docs",
        edit: {
          category: "icons",
          status: "trying",
          tags: ["React", "css"],
          note: "Good docs",
          groupIds: ["c1", "p1"],
        },
      });
    });
    await vi.waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("opens the editor with what was saved before", async () => {
    const [first, ...rest] = SNAPSHOT.resources;
    if (first === undefined) throw new Error("fixture");
    await renderLibrary({
      ...SNAPSHOT,
      resources: [{ ...first, categoryOverride: "icons", tags: ["a", "b"], note: "Hi" }, ...rest],
    });

    fireEvent.click(await screen.findByRole("button", { name: "Edit Docs | Motion" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit link" });

    expect(within(dialog).getByRole("combobox", { name: /^Category/ })).toHaveTextContent("Icons");
    expect(within(dialog).getByRole("textbox", { name: "Tags" })).toHaveValue("a, b");
    expect(within(dialog).getByRole("textbox", { name: /Why it.s here/ })).toHaveValue("Hi");
  });

  it("won't save while the collections are still loading", async () => {
    await renderLibrary();
    const respond = vi.mocked(invoke).getMockImplementation();
    vi.mocked(invoke).mockImplementation((command, args) =>
      command === "list_groups"
        ? new Promise(() => undefined)
        : (respond?.(command, args) ?? Promise.resolve(null)),
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Docs | Motion" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit link" });
    const save = within(dialog).getByRole("button", { name: "Save" });
    const form = save.closest("form");
    if (form === null) throw new Error("Save is not in a form");
    expect(save).toHaveAttribute("aria-disabled", "true");

    // Enter in a field submits the form directly; saving now would clear the link's groups.
    fireEvent.submit(form);

    expect(invoke).not.toHaveBeenCalledWith("update_resource", expect.anything());
  });

  it("shows tags on the card and finds links by tag or note", async () => {
    const [first, ...rest] = SNAPSHOT.resources;
    if (first === undefined) throw new Error("fixture");
    await renderLibrary({
      ...SNAPSHOT,
      resources: [{ ...first, tags: ["springy"], note: "Lovely easing" }, ...rest],
    });
    expect(await screen.findByText("springy")).toBeInTheDocument();
    const search = screen.getByRole("searchbox", { name: "Search library" });

    fireEvent.change(search, { target: { value: "springy" } });
    expect(
      within(screen.getByRole("region", { name: "Animation" })).getAllByRole("heading", {
        level: 3,
      }),
    ).toHaveLength(1);
    expect(screen.queryByRole("region", { name: "UI components" })).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "lovely" } });
    expect(screen.queryByRole("region", { name: "UI components" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Animation" })).toBeInTheDocument();
  });

  it("describes a library with no browser selected", async () => {
    await renderLibrary({ source: { browser: "", folder: "", warning: null }, resources: [] });

    expect(await screen.findByText(/No links yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  });

  it("summarizes links saved without a browser", async () => {
    await renderLibrary({
      source: { browser: "", folder: "", warning: null },
      resources: [
        {
          ...AWWWARDS,
          isNew: false,
          categoryOverride: null,
          status: null,
          tags: [],
          note: null,
          lastOpenedAt: null,
          linkHealth: null,
        },
      ],
    });

    expect(await screen.findByText("1 developer resource, added in DevAtlas.")).toBeInTheDocument();
  });

  it("still shows saved links when the browser can't be read, and says why", async () => {
    await renderLibrary({
      source: { browser: "Brave", folder: "develop", warning: "Bookmarks were not found." },
      resources: [
        {
          ...AWWWARDS,
          isNew: false,
          categoryOverride: null,
          status: null,
          tags: [],
          note: null,
          lastOpenedAt: null,
          linkHealth: null,
        },
      ],
    });

    expect(await findAlert("Bookmarks were not found.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Best Portfolio Websites/ })).toBeInTheDocument();
  });

  it("marks broken and moved links and filters to broken ones", async () => {
    const [first, second, ...rest] = SNAPSHOT.resources;
    if (first === undefined || second === undefined) throw new Error("fixture");
    await renderLibrary({
      ...SNAPSHOT,
      resources: [{ ...first, linkHealth: "broken" }, { ...second, linkHealth: "moved" }, ...rest],
    });

    expect(await screen.findByText("Broken link")).toBeInTheDocument();
    expect(screen.getByText("Moved")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Broken/ }));
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1);
  });

  it("shows reading status and filters by it", async () => {
    const [first, ...rest] = SNAPSHOT.resources;
    if (first === undefined) throw new Error("fixture");
    await renderLibrary({ ...SNAPSHOT, resources: [{ ...first, status: "to-read" }, ...rest] });

    expect(await screen.findByRole("button", { name: /^To read/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^To read/ }));

    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1);
  });

  it("shows everything when a filter's links are gone", async () => {
    vi.mocked(invoke).mockClear();
    vi.mocked(invoke).mockImplementation((command, args) => {
      if (command === "list_library") return Promise.resolve(SNAPSHOT);
      if (command === "list_groups") return Promise.resolve([]);
      const { url } = args as { url: string };
      return Promise.resolve({ title: null, image: `${url}/og.png`, icon: null });
    });
    render(
      <AppProviders>
        <MemoryRouter initialEntries={["/library?filter=to-read"]}>
          <LibraryPage />
        </MemoryRouter>
      </AppProviders>,
    );

    expect(await screen.findByRole("region", { name: "UI components" })).toBeInTheDocument();
  });

  it("records opening a link in the browser", async () => {
    await renderLibrary();

    fireEvent.click(screen.getByRole("button", { name: "Open reactbits.dev in your browser" }));

    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("mark_resource_opened", {
        id: "reactbits.dev/get-started/index",
      });
    });
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
