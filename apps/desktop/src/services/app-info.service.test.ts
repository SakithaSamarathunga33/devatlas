import { invoke, isTauri } from "@tauri-apps/api/core";
import { describe, expect, it, vi } from "vitest";

import { getAppInfo } from "@/services/app-info.service";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: vi.fn(() => true),
}));

const invokeMock = vi.mocked(invoke);
const isTauriMock = vi.mocked(isTauri);

describe("getAppInfo", () => {
  it("invokes the get_app_info command and returns the validated payload", async () => {
    invokeMock.mockResolvedValue({ name: "DevAtlas", version: "0.1.0", platform: "windows" });

    await expect(getAppInfo()).resolves.toEqual({
      name: "DevAtlas",
      version: "0.1.0",
      platform: "windows",
    });
    expect(invokeMock).toHaveBeenCalledExactlyOnceWith("get_app_info");
  });

  it("rejects a payload that breaks the IPC contract", async () => {
    invokeMock.mockResolvedValue({ name: "DevAtlas", version: 1 });

    await expect(getAppInfo()).rejects.toThrow("unexpected shape");
  });

  it("surfaces the backend's error message when the command fails", async () => {
    invokeMock.mockRejectedValue("Command get_app_info not allowed by ACL");

    await expect(getAppInfo()).rejects.toThrow(
      'The backend command "get_app_info" failed: Command get_app_info not allowed by ACL',
    );
  });

  it("explains the problem instead of invoking when not running inside Tauri", async () => {
    isTauriMock.mockReturnValue(false);

    await expect(getAppInfo()).rejects.toThrow("outside the desktop app");
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
