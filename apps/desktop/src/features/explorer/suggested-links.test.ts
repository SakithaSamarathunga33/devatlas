import { describe, expect, it } from "vitest";

import { ECOSYSTEMS } from "@/lib/ecosystems";

import { SUGGESTED_LINKS, suggestionId } from "./suggested-links";

describe("suggested links", () => {
  it("names each link once, over https", () => {
    const ids = SUGGESTED_LINKS.map(({ url }) => suggestionId(url));

    expect(new Set(ids).size).toBe(ids.length);
    expect(SUGGESTED_LINKS.every(({ url }) => url.startsWith("https://"))).toBe(true);
  });

  it("covers every ecosystem and no unknown ones", () => {
    const known = ECOSYSTEMS.map(({ id }) => id).sort();
    const used = [...new Set(SUGGESTED_LINKS.map(({ ecosystem }) => ecosystem))].sort();

    expect(used).toEqual(known);
  });

  it("builds ids the way the library does", () => {
    expect(suggestionId("https://www.Example.com/docs/")).toBe("example.com/docs");
    expect(suggestionId("https://example.com/")).toBe("example.com");
  });
});
