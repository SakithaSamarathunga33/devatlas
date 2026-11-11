import { describe, expect, it } from "vitest";

import { CATEGORY_META } from "./resource-categories";

describe("CATEGORY_META", () => {
  it("colours every category from the brand category tokens, not Tailwind's palette", () => {
    for (const { swatch, tint } of Object.values(CATEGORY_META)) {
      expect(swatch).toMatch(/^bg-category-[a-z]+$/);
      expect(tint).toMatch(/^from-category-[a-z]+\/\d+ to-category-[a-z]+\/\d+$/);
    }
  });

  it("gives each category its own swatch", () => {
    const swatches = Object.values(CATEGORY_META).map(({ swatch }) => swatch);
    expect(new Set(swatches).size).toBe(swatches.length);
  });
});
