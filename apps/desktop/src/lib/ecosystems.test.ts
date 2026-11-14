import { describe, expect, it } from "vitest";

import type { Resource } from "@/types/library.types";

import { ecosystemsOf } from "./ecosystems";

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
