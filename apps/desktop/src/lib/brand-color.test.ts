import { describe, expect, it } from "vitest";

import { brandTile } from "./brand-color";

describe("brandTile", () => {
  it("puts dark ink on light brand colours", () => {
    expect(brandTile("F7DF1E")).toEqual({ background: "#F7DF1E", ink: "#000000" }); // JavaScript
    expect(brandTile("00ADD8")).toEqual({ background: "#00ADD8", ink: "#000000" }); // Go
  });

  it("puts white ink on dark brand colours", () => {
    expect(brandTile("3776AB")).toEqual({ background: "#3776AB", ink: "#ffffff" }); // Python
    expect(brandTile("000000")).toEqual({ background: "#000000", ink: "#ffffff" }); // Rust
  });

  it("ignores a malformed colour", () => {
    expect(brandTile("nope")).toBeUndefined();
  });
});
