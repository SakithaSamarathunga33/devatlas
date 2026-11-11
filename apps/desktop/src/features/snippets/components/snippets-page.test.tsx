import { fireEvent, render, screen, within } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "@/app/providers/app-providers";
import type { Snippet } from "@/types/snippets.types";

import { SnippetsPage } from "./snippets-page";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: () => true }));

const SNIPPET: Snippet = {
  id: "s1",
  title: "Debounce",
  language: "TypeScript",
  code: "const wait = 300;",
  tags: ["utils"],
  resourceId: "a.example",
  createdAt: 1,
  updatedAt: 1,
};

function renderPage(snippets: Snippet[] = [SNIPPET], entry = "/snippets") {
  vi.mocked(invoke).mockImplementation((command) => {
    if (command === "list_snippets") return Promise.resolve(snippets);
    if (command === "list_library") {
      return Promise.resolve({
        source: { browser: "", folder: "", warning: null },
        resources: [
          {
            id: "a.example",
            title: "Attached link",
            url: "https://a.example/",
            host: "a.example",
            category: "tools",
            folder: "",
            addedAt: null,
            origin: "devatlas",
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
    }
    if (command === "create_snippet") return Promise.resolve(SNIPPET);
    return Promise.resolve(true);
  });
  render(
    <AppProviders>
      <MemoryRouter initialEntries={[entry]}>
        <SnippetsPage />
      </MemoryRouter>
    </AppProviders>,
  );
}

describe("SnippetsPage", () => {
  it("shows code, language, tags and the attached link", async () => {
    renderPage();

    const card = (await screen.findByRole("heading", { name: "Debounce" })).closest("article");
    if (!(card instanceof HTMLElement)) throw new Error("card");
    expect(card).toHaveTextContent("const wait = 300;");
    expect(card).toHaveTextContent("TypeScript");
    expect(card).toHaveTextContent("utils");
    expect(await within(card).findByText("Attached link")).toBeInTheDocument();
  });

  it("explains an empty page", async () => {
    renderPage([]);

    expect(await screen.findByText(/No snippets yet/)).toBeInTheDocument();
  });

  it("copies code to the clipboard", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Copy Debounce" }));

    expect(writeText).toHaveBeenCalledWith("const wait = 300;");
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });

  it("searches title, code and tags", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Debounce" });
    const search = screen.getByRole("searchbox", { name: "Search snippets" });

    fireEvent.change(search, { target: { value: "wait" } });
    expect(screen.getByRole("heading", { name: "Debounce" })).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "nothing-here" } });
    expect(screen.queryByRole("heading", { name: "Debounce" })).not.toBeInTheDocument();
  });

  it("creates a snippet, requiring a title and code", async () => {
    renderPage([]);
    fireEvent.click(await screen.findByRole("button", { name: "New snippet" }));
    const dialog = await screen.findByRole("dialog", { name: "New snippet" });
    const create = within(dialog).getByRole("button", { name: "Create" });
    expect(create).toBeDisabled();

    fireEvent.change(within(dialog).getByRole("textbox", { name: "Title" }), {
      target: { value: "Sleep" },
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Code" }), {
      target: { value: "  sleep(1)\n" },
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Tags" }), {
      target: { value: "a, b" },
    });
    fireEvent.click(create);

    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("create_snippet", {
        input: {
          title: "Sleep",
          language: null,
          code: "  sleep(1)\n",
          tags: ["a", "b"],
          resourceId: null,
        },
      });
    });
  });

  it("edits and deletes one", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Edit Debounce" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit snippet" });
    expect(within(dialog).getByRole("textbox", { name: "Code" })).toHaveValue("const wait = 300;");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("update_snippet", expect.objectContaining({ id: "s1" }));
    });
    await vi.waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete Debounce" }));
    const confirm = await screen.findByRole("dialog", { name: "Delete “Debounce”?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Delete" }));
    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("delete_snippet", { id: "s1" });
    });
  });
});
