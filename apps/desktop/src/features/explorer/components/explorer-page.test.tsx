import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "@/app/providers/app-providers";
import type { Resource } from "@/types/library.types";

import { SUGGESTED_LINKS, suggestionId } from "../suggested-links";
import { ExplorerPage } from "./explorer-page";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: () => true }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(() => Promise.resolve()) }));

const RUST_BOOK = "The Rust Programming Language";
const RUST_BOOK_ID = "doc.rust-lang.org/book";
const RUST_SUGGESTIONS = SUGGESTED_LINKS.filter(({ ecosystem }) => ecosystem === "rust").length;

function resource(id: string, title: string): Resource {
  return {
    id,
    title,
    url: `https://${id}/`,
    host: id,
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
  };
}

function renderExplorer(resources: Resource[], initiallyRemoved: string[] = [], route = "/") {
  let removed = initiallyRemoved;
  vi.mocked(invoke).mockReset();
  vi.mocked(invoke).mockImplementation((command, args) => {
    const payload = args as { id?: string; ids?: string[] } | undefined;
    if (command === "list_library") {
      return Promise.resolve({
        source: { browser: "", folder: "", warning: null },
        resources,
      });
    }
    if (command === "list_groups") return Promise.resolve([]);
    if (command === "list_removed_suggestions") return Promise.resolve(removed);
    if (command === "remove_suggestion") {
      removed = [...removed, payload?.id ?? ""];
      return Promise.resolve(null);
    }
    if (command === "restore_suggestions") {
      removed = removed.filter((id) => !(payload?.ids ?? []).includes(id));
      return Promise.resolve(null);
    }
    return Promise.resolve({ title: null, image: null, icon: null });
  });
  render(
    <AppProviders>
      <MemoryRouter initialEntries={[route]}>
        <ExplorerPage />
      </MemoryRouter>
    </AppProviders>,
  );
}

describe("ExplorerPage", () => {
  it("offers suggestions in every ecosystem, even with an empty library", async () => {
    renderExplorer([]);

    fireEvent.click(await screen.findByRole("button", { name: /^Rust/ }));

    expect(await screen.findByRole("link", { name: new RegExp(RUST_BOOK) })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Vue/ })).toBeInTheDocument();
  });

  it("counts the user's links together with the suggestions", async () => {
    renderExplorer([resource("b.example", "Rust notes")]);

    expect(
      await screen.findByRole("button", {
        name: new RegExp(`^Rust\\s*${String(RUST_SUGGESTIONS + 1)}`),
      }),
    ).toBeInTheDocument();
  });

  it("shows the links of the chosen ecosystem", async () => {
    renderExplorer([resource("a.example", "React Bits"), resource("b.example", "Rust notes")]);

    fireEvent.click(await screen.findByRole("button", { name: /^Rust/ }));

    expect(await screen.findByRole("link", { name: /Rust notes/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /React Bits/ })).not.toBeInTheDocument();
  });

  it("doesn't suggest a link that is already in the library", async () => {
    renderExplorer([resource(RUST_BOOK_ID, "My Rust reading")], [], "/?ecosystem=rust");

    expect(await screen.findByRole("link", { name: /My Rust reading/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: new RegExp(RUST_BOOK) })).not.toBeInTheDocument();
  });

  it("removes a suggestion and can undo it", async () => {
    renderExplorer([], [], "/?ecosystem=rust");

    fireEvent.click(await screen.findByRole("button", { name: `Remove ${RUST_BOOK}` }));

    await waitFor(() => {
      expect(screen.queryByRole("link", { name: new RegExp(RUST_BOOK) })).not.toBeInTheDocument();
    });
    expect(invoke).toHaveBeenCalledWith("remove_suggestion", { id: RUST_BOOK_ID });

    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));

    expect(await screen.findByRole("link", { name: new RegExp(RUST_BOOK) })).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("restore_suggestions", { ids: [RUST_BOOK_ID] });
  });

  it("keeps removed suggestions hidden and can bring them all back", async () => {
    renderExplorer([], [RUST_BOOK_ID], "/?ecosystem=rust");

    const restore = await screen.findByRole("button", { name: "Restore 1 removed" });
    expect(screen.queryByRole("link", { name: new RegExp(RUST_BOOK) })).not.toBeInTheDocument();

    fireEvent.click(restore);

    expect(await screen.findByRole("link", { name: new RegExp(RUST_BOOK) })).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("restore_suggestions", { ids: [RUST_BOOK_ID] });
  });

  it("doesn't offer to restore a link that is already in the library", async () => {
    renderExplorer([resource(RUST_BOOK_ID, "My Rust reading")], [RUST_BOOK_ID], "/?ecosystem=rust");

    expect(await screen.findByRole("link", { name: /My Rust reading/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Restore/ })).not.toBeInTheDocument();
  });

  it("leaves suggestions out and says so when removals can't be read", async () => {
    renderExplorer([resource("b.example", "Rust notes")], [], "/?ecosystem=rust");
    const respond = vi.mocked(invoke).getMockImplementation();
    vi.mocked(invoke).mockImplementation((command, args) =>
      command === "list_removed_suggestions"
        ? Promise.reject(new Error("database unavailable"))
        : (respond?.(command, args) ?? Promise.resolve(null)),
    );
    cleanup();
    render(
      <AppProviders>
        <MemoryRouter initialEntries={["/?ecosystem=rust"]}>
          <ExplorerPage />
        </MemoryRouter>
      </AppProviders>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(/Suggested links aren.t available/);
    expect(await screen.findByRole("link", { name: /Rust notes/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: new RegExp(RUST_BOOK) })).not.toBeInTheDocument();
  });

  it("opens a suggestion in the viewer and remembers where to return", async () => {
    function Viewer() {
      const { state } = useLocation() as { state: { from: string } };
      return <p>Back to {state.from}</p>;
    }
    renderExplorer([], [], "/?ecosystem=rust");
    cleanup();
    render(
      <AppProviders>
        <MemoryRouter initialEntries={["/?ecosystem=rust"]}>
          <Routes>
            <Route path="/" element={<ExplorerPage />} />
            <Route path="/explorer/view" element={<Viewer />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    fireEvent.click(await screen.findByRole("link", { name: new RegExp(RUST_BOOK) }));

    expect(await screen.findByText("Back to /?ecosystem=rust")).toBeInTheDocument();
  });

  it("explains when nothing is left to show", async () => {
    renderExplorer(
      [resource("a.example", "Some page")],
      SUGGESTED_LINKS.map(({ url }) => suggestionId(url)),
    );

    expect(await screen.findByText(/No ecosystems found yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Restore \d+ removed/ })).toBeInTheDocument();
  });
});
