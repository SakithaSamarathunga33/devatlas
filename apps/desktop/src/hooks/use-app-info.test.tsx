import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useUpdateCheck } from "@/hooks/use-app-info";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: () => true }));

const RELEASE = {
  tag: "v0.1.0-build.29",
  name: "DevAtlas v0.1.0-build.29",
  url: "https://github.com/owner/devatlas/releases/tag/v0.1.0-build.29",
  publishedAt: "2026-11-14T10:00:00Z",
};
const FIVE_MINUTES = 5 * 60 * 1000;

function renderCheck() {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useUpdateCheck(), { wrapper });
}

const checks = () => vi.mocked(invoke).mock.calls.length;

describe("useUpdateCheck", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(invoke).mockReset();
  });

  it("checks again every few minutes until a release is found, then stops", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(invoke).mockResolvedValueOnce(null).mockResolvedValue(RELEASE);
    const { result } = renderCheck();
    await waitFor(() => {
      expect(checks()).toBe(1);
    });

    await act(() => vi.advanceTimersByTimeAsync(FIVE_MINUTES));
    await waitFor(() => {
      expect(result.current.data?.tag).toBe(RELEASE.tag);
    });

    await act(() => vi.advanceTimersByTimeAsync(3 * FIVE_MINUTES));
    expect(checks()).toBe(2);
  });
});
