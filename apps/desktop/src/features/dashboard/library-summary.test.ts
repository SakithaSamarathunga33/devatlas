import { describe, expect, it } from "vitest";

import type { Resource } from "@/types/library.types";

import { librarySummary } from "./library-summary";

const NOW = new Date(2026, 10, 11, 9);
const THIS_MONTH = new Date(2026, 10, 3).getTime();
const LAST_MONTH = new Date(2026, 9, 20).getTime();

function resource(addedAt: number | null, isNew = false): Resource {
  return {
    id: `example.com/${String(addedAt)}-${String(isNew)}`,
    title: "Example",
    url: "https://example.com",
    host: "example.com",
    category: "tools",
    folder: "develop",
    addedAt,
    isNew,
    origin: "browser",
    categoryOverride: null,
    status: null,
    lastOpenedAt: null,
    linkHealth: null,
    tags: [],
    note: null,
  };
}

describe("librarySummary", () => {
  it("reports saves this month and links waiting for review", () => {
    const resources = [resource(THIS_MONTH, true), resource(THIS_MONTH), resource(LAST_MONTH)];

    expect(librarySummary(resources, NOW)).toBe("2 saved this month, 1 new to review");
  });

  it("leaves out whichever count is zero", () => {
    expect(librarySummary([resource(THIS_MONTH)], NOW)).toBe("1 saved this month");
    expect(librarySummary([resource(LAST_MONTH, true)], NOW)).toBe("1 new to review");
  });

  it("does not count resources with no saved date", () => {
    expect(librarySummary([resource(null), resource(LAST_MONTH)], NOW)).toBe(
      "Nothing new this month",
    );
  });

  it("tells an empty library how to start", () => {
    expect(librarySummary([], NOW)).toBe("Save your first link with Add link");
  });
});
