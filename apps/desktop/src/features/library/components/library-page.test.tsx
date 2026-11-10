import { fireEvent, render, screen, within } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
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
    },
    {
      id: "reactbits.dev/get-started/index",
      title: "React Bits - Index",
      url: "https://reactbits.dev/get-started/index",
      host: "reactbits.dev",
      category: "ui-components",
      folder: "develop/components",
      addedAt: null,
    },
    {
      id: "uiverse.io/elements",
      title: "4508 UI elements: CSS & Tailwind",
      url: "https://uiverse.io/elements",
      host: "uiverse.io",
      category: "ui-components",
      folder: "develop/components",
      addedAt: null,
    },
  ],
};

async function renderLibrary() {
  vi.mocked(invoke).mockResolvedValue(SNAPSHOT);
  render(
    <AppProviders>
      <LibraryPage />
    </AppProviders>,
  );
  await screen.findByRole("region", { name: "UI components" });
}

describe("LibraryPage", () => {
  it("groups resources from Brave under their categories", async () => {
    await renderLibrary();

    expect(screen.getByText(/3 developer resources from Brave › develop/)).toBeInTheDocument();
    const components = screen.getByRole("region", { name: "UI components" });
    expect(within(components).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("region", { name: "Animation" })).toHaveTextContent("Docs | Motion");
    expect(invoke).toHaveBeenCalledWith("list_library");
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

  it("opens a resource in the system browser", async () => {
    await renderLibrary();

    fireEvent.click(screen.getByRole("button", { name: /React Bits - Index/ }));

    expect(openUrl).toHaveBeenCalledWith("https://reactbits.dev/get-started/index");
  });
});
