import { describe, expect, it } from "vitest";

import type { Resource } from "@/types/library.types";

import { findArrivals } from "./library-arrivals";

function resource(id: string, isNew: boolean): Resource {
  return {
    id,
    title: id,
    url: `https://${id}/`,
    host: id,
    category: "other",
    folder: "develop",
    addedAt: null,
    origin: "browser",
    isNew,
    categoryOverride: null,
    status: null,
    lastOpenedAt: null,
    linkHealth: null,
    tags: [],
    note: null,
  };
}

describe("findArrivals", () => {
  it("announces every new resource on the first load", () => {
    const arrivals = findArrivals(null, [resource("a.dev", true), resource("b.dev", false)]);

    expect(arrivals.map((r) => r.id)).toEqual(["a.dev"]);
  });

  it("announces only resources that became new since the last snapshot", () => {
    const arrivals = findArrivals(new Set(["a.dev"]), [
      resource("a.dev", true),
      resource("c.dev", true),
    ]);

    expect(arrivals.map((r) => r.id)).toEqual(["c.dev"]);
  });

  it("announces nothing when nothing is new", () => {
    expect(findArrivals(new Set(), [resource("a.dev", false)])).toEqual([]);
  });
});
