import { describe, expect, it } from "vitest";

import { buildInterests, interestMatcher } from "./interests";

describe("buildInterests", () => {
  it("combines tags and ecosystems, lowercased and unique", () => {
    expect(buildInterests(["React", "css"], ["react", "Rust"])).toEqual(["react", "css", "rust"]);
  });

  it("drops words too generic to mean anything", () => {
    expect(buildInterests(["api", "go", "ui"], ["types", "utils"])).toEqual(["go"]);
  });
});

describe("interestMatcher", () => {
  it("matches whole words, ignoring case", () => {
    const matches = interestMatcher(["rust", "go"]);

    expect(matches("Why Rust is fast")).toBe(true);
    expect(matches("Trusted computing")).toBe(false);
    expect(matches("Let's go")).toBe(true);
    expect(matches("Mongoose")).toBe(false);
  });

  it("handles names with regex characters", () => {
    expect(interestMatcher(["c++"])("Modern C++ tips")).toBe(true);
    expect(interestMatcher(["next.js"])("next.js 16")).toBe(true);
  });

  it("matches nothing without interests", () => {
    expect(interestMatcher([])("anything")).toBe(false);
  });
});
