import { invoke, isTauri } from "@tauri-apps/api/core";
import { describe, expect, it, vi } from "vitest";

import { checkForUpdate, getAppInfo, installUpdate } from "@/services/app-info.service";

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

describe("checkForUpdate", () => {
  it("returns the newer release, or null when up to date", async () => {
    isTauriMock.mockReturnValue(true);
    const release = {
      tag: "v0.1.0-build.24",
      name: null,
      url: "https://github.com/owner/devatlas/releases/tag/v0.1.0-build.24",
      publishedAt: "2026-11-14T10:00:00Z",
    };
    invokeMock.mockResolvedValueOnce(release).mockResolvedValueOnce(null);

    await expect(checkForUpdate()).resolves.toEqual(release);
    await expect(checkForUpdate()).resolves.toBeNull();
    expect(invokeMock).toHaveBeenLastCalledWith("check_for_update");
  });

  it("rejects a release link that does not point at GitHub", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockResolvedValue({
      tag: "v9",
      name: null,
      url: "https://evil.example/setup.exe",
      publishedAt: "2026-11-14T10:00:00Z",
    });

    await expect(checkForUpdate()).rejects.toThrow("unexpected shape");
  });
});

describe("installUpdate", () => {
  it("asks the backend to install the update, naming nothing itself", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockResolvedValue(null);

    await expect(installUpdate()).resolves.toBeUndefined();
    expect(invokeMock).toHaveBeenLastCalledWith("install_update");
  });
});
