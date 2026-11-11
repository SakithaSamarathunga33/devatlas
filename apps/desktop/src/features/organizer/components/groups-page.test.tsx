import { fireEvent, render, screen, within } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "@/app/providers/app-providers";
import type { LibrarySnapshot, Resource } from "@/types/library.types";
import type { Group } from "@/types/organizer.types";

import {
  CollectionDetailPage,
  CollectionsPage,
  ProjectDetailPage,
  ProjectsPage,
} from "./groups-page";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: () => true }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(() => Promise.resolve()) }));

function resource(id: string, title: string): Resource {
  return {
    id,
    title,
    url: `https://${id}/`,
    host: id,
    category: "tools",
    folder: "",
    addedAt: null,
    origin: "devatlas",
    isNew: false,
    categoryOverride: null,
    tags: [],
    note: null,
  };
}

const LIBRARY: LibrarySnapshot = {
  source: { browser: "", folder: "", warning: null },
  resources: [resource("motion.dev", "Motion"), resource("uiverse.io", "Uiverse")],
};

function group(overrides: Partial<Group>): Group {
  return {
    id: "c1",
    kind: "collection",
    name: "Client work",
    description: "For Acme",
    resourceIds: [],
    createdAt: 1,
    ...overrides,
  };
}

function renderAt(path: string, groups: Group[]) {
  vi.mocked(invoke).mockImplementation((command, args) => {
    if (command === "list_groups") return Promise.resolve(groups);
    if (command === "list_library") return Promise.resolve(LIBRARY);
    if (command === "create_group") {
      const { kind, name, description } = args as Pick<Group, "kind" | "name" | "description">;
      return Promise.resolve(group({ id: "new", kind, name, description }));
    }
    if (command === "update_group") return Promise.resolve(true);
    if (command === "delete_group") return Promise.resolve(true);
    if (command === "set_group_resources") return Promise.resolve(true);
    return Promise.resolve({ title: null, image: null, icon: null });
  });
  render(
    <AppProviders>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/collections" element={<CollectionsPage />} />
          <Route path="/collections/:groupId" element={<CollectionDetailPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:groupId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe("Collections and Projects", () => {
  it("lists only this page's kind, linking to each", async () => {
    renderAt("/collections", [
      group({ resourceIds: ["motion.dev"] }),
      group({ id: "p1", kind: "project", name: "Website" }),
    ]);

    const link = await screen.findByRole("link", { name: /Client work/ });
    expect(link).toHaveAttribute("href", "/collections/c1");
    expect(link).toHaveTextContent("For Acme");
    expect(link).toHaveTextContent("1 link");
    expect(screen.queryByText("Website")).not.toBeInTheDocument();
  });

  it("counts only links still in the library", async () => {
    renderAt("/collections", [group({ resourceIds: ["motion.dev", "removed.example"] })]);

    expect(await screen.findByRole("link", { name: /Client work/ })).toHaveTextContent("1 link");
  });

  it("explains an empty page, in terms of its kind", async () => {
    renderAt("/projects", []);

    expect(await screen.findByText(/No projects yet/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Projects" })).toBeInTheDocument();
  });

  it("creates one, requiring a name", async () => {
    renderAt("/projects", []);
    await screen.findByText(/No projects yet/);

    fireEvent.click(screen.getByRole("button", { name: "New project" }));
    const dialog = await screen.findByRole("dialog", { name: "New project" });
    const create = within(dialog).getByRole("button", { name: "Create" });
    expect(create).toBeDisabled();
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Name" }), {
      target: { value: "Website" },
    });
    fireEvent.click(create);

    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("create_group", {
        kind: "project",
        name: "Website",
        description: null,
      });
    });
    await vi.waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("shows a group's links", async () => {
    renderAt("/collections/c1", [group({ resourceIds: ["motion.dev"] })]);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Client work" }),
    ).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /Motion/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Uiverse/ })).not.toBeInTheDocument();
  });

  it("adds and removes links, keeping ones hidden from the library", async () => {
    renderAt("/collections/c1", [group({ resourceIds: ["motion.dev", "removed.example"] })]);
    await screen.findByRole("heading", { level: 1, name: "Client work" });

    fireEvent.click(await screen.findByRole("button", { name: "Manage links" }));
    const dialog = await screen.findByRole("dialog", { name: "Manage links" });
    expect(within(dialog).getByRole("checkbox", { name: "Motion" })).toBeChecked();
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Motion" }));
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Uiverse" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("set_group_resources", {
        id: "c1",
        resourceIds: ["removed.example", "uiverse.io"],
      });
    });
  });

  it("filters the link picker", async () => {
    renderAt("/collections/c1", [group({})]);
    fireEvent.click(await screen.findByRole("button", { name: "Manage links" }));
    const dialog = await screen.findByRole("dialog", { name: "Manage links" });

    fireEvent.change(within(dialog).getByRole("searchbox", { name: "Filter links" }), {
      target: { value: "uiv" },
    });

    expect(within(dialog).getAllByRole("checkbox")).toHaveLength(1);
  });

  it("renames one", async () => {
    renderAt("/collections/c1", [group({})]);

    fireEvent.click(await screen.findByRole("button", { name: "Edit collection" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit collection" });
    expect(within(dialog).getByRole("textbox", { name: "Name" })).toHaveValue("Client work");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Name" }), {
      target: { value: "Acme" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("update_group", {
        id: "c1",
        name: "Acme",
        description: "For Acme",
      });
    });
  });

  it("confirms before deleting, then returns to the list", async () => {
    renderAt("/collections/c1", [group({})]);

    fireEvent.click(await screen.findByRole("button", { name: "Delete collection" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete “Client work”?" });
    expect(dialog).toHaveTextContent("The links stay in your library.");
    expect(invoke).not.toHaveBeenCalledWith("delete_group", expect.anything());
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Collections" })).toBeVisible();
    expect(invoke).toHaveBeenCalledWith("delete_group", { id: "c1" });
  });

  it("says when a group no longer exists", async () => {
    renderAt("/collections/gone", []);

    expect(await screen.findByText(/This collection no longer exists/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Collections" })).toHaveAttribute(
      "href",
      "/collections",
    );
  });

  it("says so when the library can't be read, rather than showing empty groups", async () => {
    vi.mocked(invoke).mockImplementation((command) =>
      command === "list_groups"
        ? Promise.resolve([group({ resourceIds: ["motion.dev"] })])
        : Promise.reject(new Error("The library is unavailable.")),
    );
    render(
      <AppProviders>
        <MemoryRouter>
          <CollectionsPage />
        </MemoryRouter>
      </AppProviders>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("The library is unavailable.");
    expect(screen.queryByText("0 links")).not.toBeInTheDocument();
  });

  it("returns focus to the button that opened a dialog", async () => {
    renderAt("/collections/c1", [group({})]);
    const opener = await screen.findByRole("button", { name: "Edit collection" });
    opener.focus();

    fireEvent.click(opener);
    const dialog = await screen.findByRole("dialog", { name: "Edit collection" });
    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    cancel.focus();
    fireEvent.click(cancel);

    await vi.waitFor(() => {
      expect(screen.getByRole("button", { name: "Edit collection" })).toHaveFocus();
    });
  });

  it("explains when they can't be loaded", async () => {
    vi.mocked(invoke).mockImplementation((command) =>
      command === "list_groups"
        ? Promise.reject(new Error("DevAtlas couldn't open its database."))
        : Promise.resolve(LIBRARY),
    );
    render(
      <AppProviders>
        <MemoryRouter>
          <CollectionsPage />
        </MemoryRouter>
      </AppProviders>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't open its database");
  });
});
