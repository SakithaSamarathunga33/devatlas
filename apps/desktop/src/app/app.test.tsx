import { render, screen, within } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { describe, expect, it, vi } from "vitest";

import { App } from "@/app/app";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: () => true,
}));

const invokeMock = vi.mocked(invoke);

// Dashboard sections fade in with Motion, which does not animate under jsdom, so these
// tests assert presence rather than visibility.
describe("App", () => {
  it("renders the shell with app information from the Rust backend", async () => {
    invokeMock.mockResolvedValue({ name: "DevAtlas", version: "0.1.0", platform: "windows" });

    render(<App />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Welcome to DevAtlas" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(await screen.findByText("0.1.0")).toBeInTheDocument();
    expect(screen.getByText("Windows")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Backend connected");
    expect(invokeMock).toHaveBeenCalledWith("get_app_info");
  });

  it("shows an actionable error when the backend command fails", async () => {
    invokeMock.mockRejectedValue("Command get_app_info not allowed by ACL");

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Command get_app_info not allowed by ACL",
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("Backend unavailable");
  });

  it("lists planned modules as a roadmap, not as working features", () => {
    invokeMock.mockResolvedValue({ name: "DevAtlas", version: "0.1.0", platform: "windows" });

    render(<App />);

    const roadmap = screen.getByRole("region", { name: "What's on the way" });
    const items = within(roadmap).getAllByRole("listitem");
    expect(items.map((item) => within(item).getByRole("heading").textContent)).toEqual([
      "Library",
      "Collections",
      "Explorer",
      "Discovery",
      "Projects",
    ]);
    expect(within(roadmap).getAllByText("Planned")).toHaveLength(5);
  });
});
