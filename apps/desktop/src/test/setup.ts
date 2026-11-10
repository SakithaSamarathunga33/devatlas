import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, vi } from "vitest";

// jsdom lacks these observers (every real webview has them); Motion and the site viewer use them.
class ObserverStub {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
}
vi.stubGlobal("IntersectionObserver", ObserverStub);
vi.stubGlobal("ResizeObserver", ObserverStub);
// Gooey Nav checks prefers-reduced-motion; jsdom has no matchMedia.
vi.stubGlobal(
  "matchMedia",
  vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  })),
);

afterEach(() => {
  // Sonner keeps toasts in a module-level store, so they would leak into the next test.
  toast.dismiss();
  cleanup();
});
