import { fireEvent, render, screen } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "@/app/providers/app-providers";
import type { LibrarySnapshot } from "@/types/library.types";

import { ResourceViewerPage } from "./resource-viewer-page";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: () => true }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(() => Promise.resolve(vi.fn())) }));
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
      folder: "develop",
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

function renderViewer(path: string) {
  vi.mocked(invoke).mockImplementation((command) =>
    Promise.resolve(command === "list_library" ? SNAPSHOT : null),
  );
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/library/:resourceId" element={<ResourceViewerPage />} />
          <Route path="/library" element={<p>Library list</p>} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe("ResourceViewerPage", () => {
  it("opens the site in the in-app viewer and closes it when leaving", async () => {
    const view = renderViewer("/library/motion.dev%2Fdocs");

    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("viewer_open", {
        url: "https://motion.dev/docs",
        bounds: { x: 0, y: 0, width: 0, height: 0 },
      });
    });
    expect(screen.getByText("https://motion.dev/docs")).toBeInTheDocument();

    view.unmount();
    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("viewer_close");
    });
  });

  it("moves the site with its frame when the layout shifts without resizing it", async () => {
    renderViewer("/library/motion.dev%2Fdocs");
    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("viewer_open", expect.anything());
    });

    // The sidebar collapses: the frame slides left, keeping its size.
    const moved = { left: 64, top: 48, width: 0, height: 0 } as DOMRect;
    const spy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(moved);

    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("viewer_set_bounds", {
        bounds: { x: 64, y: 48, width: 0, height: 0 },
      });
    });
    spy.mockRestore();
  });

  it("offers browser-style controls and the system browser as a fallback", async () => {
    renderViewer("/library/motion.dev%2Fdocs");
    await screen.findByRole("button", { name: "Reload" });

    fireEvent.click(screen.getByRole("button", { name: "Go back" }));
    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("viewer_go", { action: "back" });
    });

    fireEvent.click(screen.getByRole("button", { name: /Open in browser/ }));
    expect(openUrl).toHaveBeenCalledWith("https://motion.dev/docs");
    expect(screen.getByRole("link", { name: "Back to library" })).toHaveAttribute(
      "href",
      "/library",
    );
  });

  it("explains when the resource is no longer in the library", async () => {
    renderViewer("/library/gone.example");

    expect(
      await screen.findByText("This resource is no longer in your library."),
    ).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalledWith("viewer_open", expect.anything());
  });

  it("clears the new mark when a new resource is opened", async () => {
    const [motion] = SNAPSHOT.resources;
    vi.mocked(invoke).mockImplementation((command) =>
      Promise.resolve(
        command === "list_library"
          ? { ...SNAPSHOT, resources: motion ? [{ ...motion, isNew: true }] : [] }
          : null,
      ),
    );
    render(
      <AppProviders>
        <MemoryRouter initialEntries={["/library/motion.dev%2Fdocs"]}>
          <Routes>
            <Route path="/library/:resourceId" element={<ResourceViewerPage />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("mark_resource_opened", { id: "motion.dev/docs" });
    });
  });
});
