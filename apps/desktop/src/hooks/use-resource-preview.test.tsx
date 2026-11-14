import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { useResourcePreview } from "@/hooks/use-resource-preview";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: () => true }));

const PREVIEW = {
  title: "Some page",
  image: "https://opengraph.example/card.png",
  icon: "https://github.githubassets.com/favicons/favicon.svg",
};

function previewFor(url: string) {
  vi.mocked(invoke).mockResolvedValue(PREVIEW);
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useResourcePreview(url), { wrapper });
}

describe("useResourcePreview", () => {
  it("uses the owner's avatar as the icon of a GitHub repository", async () => {
    const { result } = previewFor("https://github.com/emilkowalski/skills");

    await waitFor(() => {
      expect(result.current.data?.icon).toBe("https://github.com/emilkowalski.png?size=96");
    });
    expect(result.current.data?.image).toBe(PREVIEW.image);
  });

  it("keeps the site's own icon for other pages, including GitHub's own", async () => {
    for (const url of ["https://uiverse.io/elements", "https://github.com/trending"]) {
      const { result } = previewFor(url);

      await waitFor(() => {
        expect(result.current.data?.icon).toBe(PREVIEW.icon);
      });
    }
  });
});
