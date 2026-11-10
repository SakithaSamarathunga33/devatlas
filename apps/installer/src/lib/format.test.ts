import { describe, expect, it } from "vitest";

import { formatBytes, withAppFolder } from "@/lib/format";

describe("formatBytes", () => {
  it("shows whole megabytes below a gigabyte", () => {
    expect(formatBytes(320 * 1024 ** 2)).toBe("320 MB");
    expect(formatBytes(1000)).toBe("< 1 MB");
  });

  it("shows one decimal of gigabytes above a gigabyte", () => {
    expect(formatBytes(128.4 * 1024 ** 3)).toBe("128.4 GB");
  });
});

describe("withAppFolder", () => {
  it("appends the app folder to a picked parent folder", () => {
    expect(withAppFolder("D:\\Apps")).toBe("D:\\Apps\\DevAtlas");
    expect(withAppFolder("D:\\Apps\\")).toBe("D:\\Apps\\DevAtlas");
  });

  it("keeps a folder that already is the app folder", () => {
    expect(withAppFolder("D:\\Apps\\devatlas")).toBe("D:\\Apps\\devatlas");
  });

  it("handles a drive root", () => {
    expect(withAppFolder("D:\\")).toBe("D:\\DevAtlas");
  });
});
