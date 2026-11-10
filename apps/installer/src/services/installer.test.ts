import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { describe, expect, it, vi } from "vitest";

import {
  getAvailableSpace,
  getInstallDefaults,
  install,
  launchApp,
  pickFolder,
} from "@/services/installer";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: vi.fn(() => true),
  Channel: vi.fn(function Channel(this: { onmessage: unknown }, onmessage: unknown) {
    this.onmessage = onmessage;
  }),
}));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));

const invokeMock = vi.mocked(invoke);

describe("installer service", () => {
  it("validates the install defaults", async () => {
    invokeMock.mockResolvedValue({ dir: "C:\\DevAtlas", requiredBytes: 10, version: "0.1.0" });

    await expect(getInstallDefaults()).resolves.toEqual({
      dir: "C:\\DevAtlas",
      requiredBytes: 10,
      version: "0.1.0",
    });
    expect(invokeMock).toHaveBeenCalledWith("get_install_defaults", undefined);
  });

  it("rejects defaults in the wrong shape", async () => {
    invokeMock.mockResolvedValue({ dir: "", requiredBytes: -1 });

    await expect(getInstallDefaults()).rejects.toThrow("unexpected data");
  });

  it("passes the backend's error message through", async () => {
    invokeMock.mockRejectedValue("Not enough free space: 40.0 MB needed, 1.0 MB available.");

    await expect(launchApp()).rejects.toThrow("Not enough free space");
  });

  it("allows an unknown amount of free space", async () => {
    invokeMock.mockResolvedValue(null);

    await expect(getAvailableSpace("C:\\x")).resolves.toBeNull();
    expect(invokeMock).toHaveBeenCalledWith("get_available_space", { dir: "C:\\x" });
  });

  it("streams validated progress and drops malformed messages", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onProgress = vi.fn();
    invokeMock.mockImplementation((_command, args) => {
      const { onProgress: channel } = args as { onProgress: { onmessage: (m: unknown) => void } };
      channel.onmessage({ step: "extracting", percent: 40 });
      channel.onmessage({ step: "teleporting", percent: 500 });
      return Promise.resolve(null);
    });
    const options = { dir: "C:\\DevAtlas", desktopShortcut: true, startMenuShortcut: false };

    await install(options, onProgress);

    expect(Channel).toHaveBeenCalledOnce();
    expect(invokeMock).toHaveBeenCalledWith("install", {
      options,
      onProgress: expect.any(Object) as unknown,
    });
    expect(onProgress).toHaveBeenCalledExactlyOnceWith({ step: "extracting", percent: 40 });
    expect(warn).toHaveBeenCalledOnce();
  });

  it("refuses to call the backend outside Tauri", async () => {
    vi.mocked(isTauri).mockReturnValueOnce(false);

    await expect(launchApp()).rejects.toThrow("must run as the desktop installer");
  });

  it("returns the picked folder, or null when cancelled", async () => {
    vi.mocked(open).mockResolvedValueOnce("D:\\Apps").mockResolvedValueOnce(null);

    await expect(pickFolder("C:\\")).resolves.toBe("D:\\Apps");
    await expect(pickFolder("C:\\")).resolves.toBeNull();
  });
});
