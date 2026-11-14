import { afterEach, describe, expect, it, vi } from "vitest";

import { revealThemeChange } from "./theme-transition";

function stubMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: reduce })),
  );
}

describe("revealThemeChange", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, "startViewTransition");
    delete document.documentElement.dataset.themeReveal;
  });

  it("changes the theme at once where view transitions aren't available", () => {
    stubMotion(false);
    const apply = vi.fn();

    revealThemeChange(document.createElement("button"), apply);

    expect(apply).toHaveBeenCalledOnce();
  });

  it("changes the theme at once when the user prefers reduced motion", () => {
    stubMotion(true);
    const start = vi.fn();
    Object.assign(document, { startViewTransition: start });
    const apply = vi.fn();

    revealThemeChange(document.createElement("button"), apply);

    expect(apply).toHaveBeenCalledOnce();
    expect(start).not.toHaveBeenCalled();
  });

  it("applies the theme inside a view transition and ignores clicks until it ends", () => {
    stubMotion(false);
    const never = new Promise<void>(() => undefined);
    const start = vi.fn((update: () => void) => {
      update();
      return { ready: never, finished: never };
    });
    Object.assign(document, { startViewTransition: start });
    const apply = vi.fn();
    const button = document.createElement("button");

    revealThemeChange(button, apply);
    revealThemeChange(button, apply);

    expect(start).toHaveBeenCalledOnce();
    expect(apply).toHaveBeenCalledOnce();
    expect(document.documentElement.dataset.themeReveal).toBe("active");
  });
});
