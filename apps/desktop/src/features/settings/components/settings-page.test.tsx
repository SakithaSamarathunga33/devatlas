import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

let starSyncUser: string | null = null;

function renderSettings(
  view: SettingsView = VIEW,
  save: () => Promise<unknown> = () => Promise.resolve(view),
) {
  vi.mocked(invoke).mockImplementation((command, args) => {
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
    if (command === "get_agent_connection") {
      return Promise.resolve({
        executable: "C:\\Apps\\DevAtlas\\devatlas.exe",
        usage: { lookups: 3, lastAt: 1_700_000_000_000 },
      });
    }
    if (command === "import_github_stars") return Promise.resolve(12);
    if (command === "get_star_sync") return Promise.resolve(starSyncUser);
    if (command === "set_star_sync") {
      const next = (args as { username: string | null }).username;
      starSyncUser = next;
      return Promise.resolve(next);
    }
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

/** Selector is a popup listbox: open it, then pick the option by its visible name. */
async function choose(control: HTMLElement, option: string) {
  fireEvent.click(control);
  fireEvent.click(await screen.findByRole("option", { name: option }));
}

describe("SettingsPage", () => {
  it("shows the current browser, profile and folder", async () => {
    renderSettings();

    expect(await browser()).toHaveTextContent("Brave");
    expect(profile()).toHaveTextContent("Personal");
    expect(folder()).toHaveTextContent("develop");
    fireEvent.click(profile());
    expect(await screen.findByRole("option", { name: "Work" })).toBeInTheDocument();
  });

  it("moves to the first profile and folder when the browser changes", async () => {
    renderSettings();

    await choose(await browser(), "Google Chrome");

    expect(profile()).toHaveTextContent("Default");
    expect(folder()).toHaveTextContent("dev");
  });

  it("moves to the first folder when the profile changes", async () => {
    renderSettings();
    await browser();

    await choose(profile(), "Work");

    expect(folder()).toHaveTextContent("client");
  });

  it("saves the selection and confirms it", async () => {
    renderSettings();
    await browser();

    await choose(folder(), "stuffs");
    fireEvent.click(save());

    expect(await screen.findByText("Settings saved")).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("update_settings", {
      settings: { browser: "brave", profile: "Default", folder: "stuffs" },
    });
  });

  it("can use no browser at all", async () => {
    renderSettings();

    await choose(await browser(), "None, only links I add");

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
    expect(await browser()).toHaveTextContent("None, only links I add");
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

    await choose(await browser(), "Microsoft Edge");

    expect(save()).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(/has no bookmark folders/)).toBeInTheDocument();
  });

  it("keeps a saved folder selectable even if it's now empty", async () => {
    renderSettings({
      ...VIEW,
      settings: { browser: "brave", profile: "Default", folder: "archived" },
    });
    await browser();

    expect(folder()).toHaveTextContent("archived");
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

  it("shows how to connect an AI agent, using this computer's DevAtlas", async () => {
    renderSettings();

    // The code block highlights its text in pieces, so check the page's text as a whole.
    await waitFor(() => {
      expect(document.body).toHaveTextContent(
        'claude mcp add devatlas -s user -- "C:\\Apps\\DevAtlas\\devatlas.exe" --mcp',
      );
    });
    expect(screen.getByText(/3 lookups in the last 7 days/)).toBeInTheDocument();
  });

  it("imports the repositories a GitHub user starred", async () => {
    renderSettings();

    fireEvent.change(await screen.findByRole("textbox", { name: "GitHub username" }), {
      target: { value: "octocat" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import stars" }));

    expect(await screen.findByText("Added 12 repositories")).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("import_github_stars", { username: "octocat" });
  });

  it("keeps a user's stars in sync once turned on, and imports them right away", async () => {
    starSyncUser = null;
    renderSettings();

    fireEvent.change(await screen.findByRole("textbox", { name: "GitHub username" }), {
      target: { value: "octocat" },
    });
    fireEvent.click(screen.getByRole("switch", { name: /Keep my stars in sync/ }));

    expect(await screen.findByText("Added 12 repositories")).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("set_star_sync", { username: "octocat" });
    expect(invoke).toHaveBeenCalledWith("import_github_stars", { username: "octocat" });
    await waitFor(() => {
      expect(screen.getByRole("switch", { name: /Keep my stars in sync/ })).toBeChecked();
    });
  });

  it("shows a synced user and stops syncing when turned off", async () => {
    starSyncUser = "octocat";
    renderSettings();

    const toggle = await screen.findByRole("switch", { name: /Keep my stars in sync/ });
    await waitFor(() => {
      expect(toggle).toBeChecked();
    });
    expect(screen.getByRole("textbox", { name: "GitHub username" })).toHaveValue("octocat");
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("set_star_sync", { username: null });
    });
  });

  it("offers Firefox and Opera when they are installed", async () => {
    renderSettings({
      ...VIEW,
      options: [
        ...VIEW.options,
        {
          browser: "firefox",
          label: "Mozilla Firefox",
          profiles: [{ id: "x7y2.default-release", name: "default-release", folders: ["dev"] }],
        },
        {
          browser: "operagx",
          label: "Opera GX",
          profiles: [{ id: "Default", name: "Default", folders: ["dev"] }],
        },
      ],
    });

    fireEvent.click(await browser());

    expect(await screen.findByRole("option", { name: "Mozilla Firefox" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Opera GX" })).toBeInTheDocument();
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
