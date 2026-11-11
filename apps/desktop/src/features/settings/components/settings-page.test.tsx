import { fireEvent, render, screen } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "@/app/providers/app-providers";
import type { SettingsView } from "@/types/settings.types";

import { SettingsPage } from "./settings-page";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: () => true }));

const VIEW: SettingsView = {
  hasGithubToken: false,
  settings: { browser: "brave", profile: "Default", folder: "develop" },
  options: [
    {
      browser: "brave",
      label: "Brave",
      profiles: [
        { id: "Default", name: "Personal", folders: ["develop", "stuffs"] },
        { id: "Profile 1", name: "Work", folders: ["client"] },
      ],
    },
    {
      browser: "chrome",
      label: "Google Chrome",
      profiles: [{ id: "Default", name: "Default", folders: ["dev"] }],
    },
  ],
};

function renderSettings(
  view: SettingsView = VIEW,
  save: () => Promise<unknown> = () => Promise.resolve(view),
) {
  vi.mocked(invoke).mockImplementation((command) => {
    if (command === "get_settings") return Promise.resolve(view);
    if (command === "update_settings") return save();
    if (command === "set_github_token" || command === "clear_github_token") {
      return Promise.resolve(null);
    }
    if (command === "check_links") {
      return Promise.resolve({ checked: 40, broken: 2, moved: 1, unknown: 0 });
    }
    if (command === "export_backup") return Promise.resolve("devatlas-backup.json");
    if (command === "import_file") return Promise.resolve({ links: 3, groups: 1, snippets: 2 });
    return Promise.resolve({ source: { browser: "", folder: "", warning: null }, resources: [] });
  });
  render(
    <AppProviders>
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    </AppProviders>,
  );
}

const browser = () => screen.findByRole("combobox", { name: "Browser" });
const profile = () => screen.getByRole("combobox", { name: "Profile" });
const folder = () => screen.getByRole("combobox", { name: "Bookmark folder" });
const save = () => screen.getByRole("button", { name: "Save" });

describe("SettingsPage", () => {
  it("shows the current browser, profile and folder", async () => {
    renderSettings();

    expect(await browser()).toHaveValue("brave");
    expect(profile()).toHaveValue("Default");
    expect(folder()).toHaveValue("develop");
    expect(screen.getByRole("option", { name: "Personal" })).toBeInTheDocument();
  });

  it("moves to the first profile and folder when the browser changes", async () => {
    renderSettings();

    fireEvent.change(await browser(), { target: { value: "chrome" } });

    expect(profile()).toHaveValue("Default");
    expect(folder()).toHaveValue("dev");
  });

  it("moves to the first folder when the profile changes", async () => {
    renderSettings();
    await browser();

    fireEvent.change(profile(), { target: { value: "Profile 1" } });

    expect(folder()).toHaveValue("client");
  });

  it("saves the selection and confirms it", async () => {
    renderSettings();
    await browser();

    fireEvent.change(folder(), { target: { value: "stuffs" } });
    fireEvent.click(save());

    expect(await screen.findByText("Settings saved")).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("update_settings", {
      settings: { browser: "brave", profile: "Default", folder: "stuffs" },
    });
  });

  it("can use no browser at all", async () => {
    renderSettings();

    fireEvent.change(await browser(), { target: { value: "" } });

    expect(screen.queryByRole("combobox", { name: "Profile" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Bookmark folder" })).not.toBeInTheDocument();
    fireEvent.click(save());
    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("update_settings", {
        settings: { browser: null, profile: "Default", folder: "" },
      });
    });
  });

  it("says when no supported browser is installed", async () => {
    renderSettings({
      hasGithubToken: false,
      settings: { browser: null, profile: "Default", folder: "" },
      options: [],
    });

    expect(await screen.findByText(/No supported browser was found/)).toBeInTheDocument();
    expect(await browser()).toHaveValue("");
  });

  it("can't save a browser profile that has no bookmark folders", async () => {
    renderSettings({
      hasGithubToken: false,
      settings: { browser: null, profile: "Default", folder: "" },
      options: [
        {
          browser: "edge",
          label: "Microsoft Edge",
          profiles: [{ id: "Default", name: "Default", folders: [] }],
        },
      ],
    });

    fireEvent.change(await browser(), { target: { value: "edge" } });

    expect(save()).toBeDisabled();
    expect(screen.getByText(/has no bookmark folders/)).toBeInTheDocument();
  });

  it("keeps a saved folder selectable even if it's now empty", async () => {
    renderSettings({
      ...VIEW,
      settings: { browser: "brave", profile: "Default", folder: "archived" },
    });
    await browser();

    expect(folder()).toHaveValue("archived");
  });

  it("saves a GitHub token without ever showing it back", async () => {
    renderSettings();
    await browser();

    fireEvent.change(screen.getByLabelText("GitHub token"), { target: { value: "ghp_abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Save token" }));

    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("set_github_token", { token: "ghp_abc" });
    });
    await vi.waitFor(() => {
      expect(screen.getByLabelText("GitHub token")).toHaveValue("");
    });
  });

  it("says when a token is saved and can remove it", async () => {
    renderSettings({ ...VIEW, hasGithubToken: true });

    expect(await screen.findByText(/A token is saved/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove token" }));

    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("clear_github_token");
    });
  });

  it("checks links and reports the result", async () => {
    renderSettings();
    await browser();

    fireEvent.click(screen.getByRole("button", { name: "Check links" }));

    expect(await screen.findByText("Checked 40 links")).toBeInTheDocument();
    expect(await screen.findByText(/2 broken, 1 moved/)).toBeInTheDocument();
  });

  it("exports a backup", async () => {
    renderSettings();
    await browser();

    fireEvent.click(screen.getByRole("button", { name: "Export backup" }));

    expect(await screen.findByText("Backup saved")).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("export_backup");
  });

  it("imports a file and says what came in", async () => {
    renderSettings();
    await browser();

    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(await screen.findByText("Import complete")).toBeInTheDocument();
    expect(await screen.findByText(/3 links, 1 group, 2 snippets/)).toBeInTheDocument();
  });

  it("explains a failed save", async () => {
    renderSettings(VIEW, () => Promise.reject(new Error("Choose a bookmark folder.")));
    await browser();

    fireEvent.click(save());

    expect(await screen.findByText("Couldn't save your settings")).toBeInTheDocument();
  });
});
