import { describe, expect, it } from "vitest";

import type { Resource } from "@/types/library.types";

import { ecosystemsOf, rediscoverable } from "./ecosystems";

function resource(overrides: Partial<Resource>): Resource {
  return {
    id: "a.example",
    title: "A",
    url: "https://a.example/",
    host: "a.example",
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
    ...overrides,
  };
}

describe("ecosystemsOf", () => {
  it("finds an ecosystem from the title", () => {
    expect(ecosystemsOf(resource({ title: "React Bits" }))).toEqual(["react"]);
  });

  it("finds an ecosystem from the host and tags", () => {
    expect(ecosystemsOf(resource({ host: "tailwindcss.com" }))).toEqual(["css"]);
    expect(ecosystemsOf(resource({ tags: ["rust"] }))).toEqual(["rust"]);
  });

  it("doesn't match inside other words", () => {
    expect(ecosystemsOf(resource({ title: "Trusted vue-less go-between mongoose" }))).toEqual([]);
  });
});

describe("rediscoverable", () => {
  const NOW = new Date(2026, 10, 11).getTime();
  const OLD = new Date(2025, 10, 11).getTime();
  const RECENT = new Date(2026, 9, 11).getTime();

  it("offers old links not opened lately, oldest first", () => {
    const older = resource({ id: "older", addedAt: OLD - 1000 });
    const old = resource({ id: "old", addedAt: OLD });

    expect(rediscoverable([old, older], NOW).map((item) => item.id)).toEqual(["older", "old"]);
  });

  it("skips recent saves, recently opened links and links in use", () => {
    expect(
      rediscoverable(
        [
          resource({ addedAt: RECENT }),
          resource({ addedAt: OLD, lastOpenedAt: RECENT }),
          resource({ addedAt: OLD, status: "using" }),
          resource({ addedAt: null }),
        ],
        NOW,
      ),
    ).toEqual([]);
  });

  it("limits how many it offers", () => {
    const many = Array.from({ length: 9 }, (_, index) =>
      resource({ id: String(index), addedAt: OLD }),
    );

    expect(rediscoverable(many, NOW)).toHaveLength(3);
  });
});
