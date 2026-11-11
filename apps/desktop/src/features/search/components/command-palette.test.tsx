import { fireEvent, render, screen, within } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "@/app/providers/app-providers";
import type { Resource } from "@/types/library.types";

import { CommandPalette } from "./command-palette";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: () => true }));

const LINK: Resource = {
  id: "motion.dev/docs",
  title: "Motion docs",
  url: "https://motion.dev/docs",
  host: "motion.dev",
  category: "animation",
  folder: "",
  addedAt: null,
  origin: "devatlas",
  isNew: false,
  categoryOverride: null,
  status: null,
  tags: ["springy"],
  note: "Lovely easing",
  lastOpenedAt: null,
  linkHealth: null,
};

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{`${pathname}${search}`}</p>;
}

function renderPalette(path = "/") {
  vi.mocked(invoke).mockImplementation((command) => {
    if (command === "list_library") {
      return Promise.resolve({
        source: { browser: "", folder: "", warning: null },
        resources: [LINK],
      });
    }
    if (command === "list_groups") {
      return Promise.resolve([
        {
          id: "c1",
          name: "Client work",
          description: null,
          resourceIds: [],
          createdAt: 1,
        },
      ]);
    }
    if (command === "list_snippets") {
      return Promise.resolve([
        {
          id: "s1",
          title: "Debounce helper",
          language: "TypeScript",
          code: "function debounce() {}",
          tags: [],
          resourceId: null,
          createdAt: 1,
          updatedAt: 1,
        },
      ]);
    }
    return Promise.resolve(null);
  });
  render(
    <AppProviders>
      <MemoryRouter initialEntries={[path]}>
        <CommandPalette />
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

function open() {
  fireEvent.keyDown(window, { key: "k", ctrlKey: true });
  return screen.findByRole("dialog", { name: "Search everything" });
}

async function search(term: string) {
  const dialog = await open();
  fireEvent.change(within(dialog).getByRole("combobox", { name: "Search" }), {
    target: { value: term },
  });
  return dialog;
}

describe("CommandPalette", () => {
  it("opens with Ctrl K and from the header button", async () => {
    renderPalette();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Search everything/ }));

    expect(await screen.findByRole("dialog", { name: "Search everything" })).toBeInTheDocument();
  });

  it("finds links by title, tag and note", async () => {
    renderPalette();
    const dialog = await search("springy");

    expect(await within(dialog).findByRole("option", { name: /Motion docs/ })).toBeInTheDocument();

    fireEvent.change(within(dialog).getByRole("combobox", { name: "Search" }), {
      target: { value: "lovely" },
    });
    expect(await within(dialog).findByRole("option", { name: /Motion docs/ })).toBeInTheDocument();
  });

  it("finds collections and snippets, including inside the code", async () => {
    renderPalette();
    const dialog = await search("client");

    expect(await within(dialog).findByRole("option", { name: /Client work/ })).toBeInTheDocument();

    fireEvent.change(within(dialog).getByRole("combobox", { name: "Search" }), {
      target: { value: "function debounce" },
    });
    expect(
      await within(dialog).findByRole("option", { name: /Debounce helper/ }),
    ).toBeInTheDocument();
  });

  it("requires every word to match", async () => {
    renderPalette();
    const dialog = await search("motion nonsense");

    expect(await within(dialog).findByText("Nothing found.")).toBeInTheDocument();
  });

  it("lists pages before anything is typed", async () => {
    renderPalette();
    const dialog = await open();

    expect(await within(dialog).findByRole("option", { name: /Library/ })).toBeInTheDocument();
  });

  it("opens the highlighted result with Enter, moving with the arrows", async () => {
    renderPalette();
    const dialog = await search("o");
    const input = within(dialog).getByRole("combobox", { name: "Search" });
    // The highlight is the combobox's active descendant; aria-selected is Astryx's picker state.
    const highlighted = () =>
      document.getElementById(input.getAttribute("aria-activedescendant") ?? "");
    await within(dialog).findByRole("option", { name: /Motion docs/ });
    await within(dialog).findByRole("option", { name: /Client work/ });
    await within(dialog).findByRole("option", { name: /Debounce helper/ });
    const options = within(dialog).getAllByRole("option");
    await vi.waitFor(() => {
      expect(highlighted()).toBe(options[0]);
    });

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(highlighted()).toBe(within(dialog).getAllByRole("option")[1]);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.change(input, { target: { value: "springy" } });
    // Astryx commits results after a microtask, so wait for the top result to be highlighted.
    const match = await within(dialog).findByRole("option", { name: /Motion docs/ });
    await vi.waitFor(() => {
      expect(highlighted()).toBe(match);
    });
    fireEvent.keyDown(input, { key: "Enter" });

    await vi.waitFor(() => {
      expect(screen.getByTestId("where")).toHaveTextContent("/library/motion.dev%2Fdocs");
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("re-runs the query when links finish loading after it was typed", async () => {
    renderPalette();
    let finishLoading: (snapshot: unknown) => void = () => undefined;
    const loading = new Promise((resolve) => {
      finishLoading = resolve;
    });
    const respond = vi.mocked(invoke).getMockImplementation();
    vi.mocked(invoke).mockImplementation((command, args) =>
      command === "list_library" ? loading : (respond?.(command, args) ?? Promise.resolve(null)),
    );

    const dialog = await search("springy");
    expect(await within(dialog).findByText("Nothing found.")).toBeInTheDocument();

    finishLoading({ source: { browser: "", folder: "", warning: null }, resources: [LINK] });

    expect(await within(dialog).findByRole("option", { name: /Motion docs/ })).toBeInTheDocument();
  });

  it.each([
    "/library/motion.dev",
    "/news/view?url=x",
    "/discovery/view?url=x",
    "/explorer/view?url=x",
  ])("stays closed on the site viewer at %s, which sits above the app's window", (path) => {
    renderPalette(path);

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Search everything/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
