import { render, screen } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { describe, expect, it, vi } from "vitest";

import { App } from "@/app/app";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: () => true,
}));

const invokeMock = vi.mocked(invoke);

describe("App", () => {
  it("renders the shell with app information from the Rust backend", async () => {
    invokeMock.mockResolvedValue({ name: "DevAtlas", version: "0.1.0", platform: "windows" });

    render(<App />);

    // Presence, not visibility: the hero fades in, and animations do not run under jsdom.
    expect(
      screen.getByRole("heading", { level: 1, name: "Welcome to DevAtlas" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(await screen.findByText("0.1.0")).toBeVisible();
    expect(screen.getByText("Windows")).toBeVisible();
    expect(screen.getByText("Backend connected")).toBeVisible();
    expect(invokeMock).toHaveBeenCalledWith("get_app_info");
  });

  it("shows an actionable error when the backend command fails", async () => {
    invokeMock.mockRejectedValue("Command get_app_info not allowed by ACL");

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Command get_app_info not allowed by ACL",
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    expect(screen.getByText("Backend unavailable", { selector: "[role=status]" })).toBeVisible();
  });
});
