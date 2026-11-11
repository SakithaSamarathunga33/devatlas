import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "@/App";
import * as installer from "@/services/installer";

vi.mock("@/services/installer", async (importActual) => ({
  ...(await importActual<typeof installer>()),
  getInstallDefaults: vi.fn(),
  getAvailableSpace: vi.fn(),
  install: vi.fn(),
  launchApp: vi.fn(),
  pickFolder: vi.fn(),
  closeWindow: vi.fn(),
  minimizeWindow: vi.fn(),
}));

const api = vi.mocked(installer);
const DIR = "C:\\Users\\me\\AppData\\Local\\Programs\\DevAtlas";

beforeEach(() => {
  api.getInstallDefaults.mockResolvedValue({
    dir: DIR,
    requiredBytes: 40 * 1024 ** 2,
    version: "0.1.0",
  });
  api.getAvailableSpace.mockResolvedValue(128.4 * 1024 ** 3);
  api.install.mockImplementation((_options, onProgress) => {
    onProgress({ step: "extracting", percent: 50 });
    return Promise.resolve();
  });
  api.launchApp.mockResolvedValue();
  api.closeWindow.mockResolvedValue();
});

/** Astryx keeps its own empty live regions, so look for the alert that says this. */
function findAlert(text: string) {
  return waitFor(() => {
    const alerts = screen.getAllByRole("alert");
    expect(alerts.some((alert) => alert.textContent.includes(text))).toBe(true);
  });
}

async function acceptLicense() {
  fireEvent.click(await screen.findByRole("button", { name: "Install DevAtlas" }));
  fireEvent.click(screen.getByRole("checkbox", { name: /I agree/ }));
  fireEvent.click(screen.getByRole("button", { name: /Next/ }));
}

describe("setup wizard", () => {
  it("installs with the defaults after the license is accepted", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Install DevAtlas" }));
    expect(screen.getByRole("button", { name: /Next/ })).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(screen.getByRole("checkbox", { name: /I agree/ }));
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));

    expect(await screen.findByText("Installation Complete!")).toBeInTheDocument();
    expect(api.install).toHaveBeenCalledWith(
      { dir: DIR, desktopShortcut: true, startMenuShortcut: true, launchAfterInstall: false },
      expect.any(Function),
    );
  });

  it("lets the user customize the folder and shortcuts", async () => {
    api.pickFolder.mockResolvedValue("D:\\Apps");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Customize Installation" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /I agree/ }));
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(await screen.findByText(/Available Space: 128.4 GB/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Browse…" }));
    expect(await screen.findByDisplayValue("D:\\Apps\\DevAtlas")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Create a desktop shortcut" }));
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));

    await screen.findByText("Installation Complete!");
    expect(api.install).toHaveBeenCalledWith(
      expect.objectContaining({ dir: "D:\\Apps\\DevAtlas", desktopShortcut: false }),
      expect.any(Function),
    );
  });

  it("blocks Next when the drive is too small", async () => {
    api.getAvailableSpace.mockResolvedValue(1024);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Customize Installation" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /I agree/ }));
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));

    await screen.findByText(/Available Space: < 1 MB/);
    await findAlert("Not enough space");
    expect(screen.getByRole("button", { name: /Next/ })).toHaveAttribute("aria-disabled", "true");
  });

  it("shows install errors and retries", async () => {
    api.install.mockRejectedValueOnce(new Error("Could not write C:\\x: Access is denied."));
    render(<App />);

    await acceptLicense();

    await findAlert("Access is denied.");
    expect(screen.getByRole("button", { name: "Close" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Installation Complete!")).toBeInTheDocument();
  });

  it("keeps the window open while installing", async () => {
    api.install.mockReturnValue(new Promise(() => {}));
    render(<App />);

    await acceptLicense();

    expect(await screen.findByText("Installing DevAtlas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toHaveAttribute("aria-disabled", "true");
  });

  it("launches DevAtlas, then Get Started closes setup", async () => {
    render(<App />);
    await acceptLicense();

    fireEvent.click(await screen.findByRole("button", { name: /Launch DevAtlas/ }));
    expect(await screen.findByText("Ready to Get Started")).toBeInTheDocument();
    expect(api.launchApp).toHaveBeenCalledOnce();
    expect(screen.getByText(/Trending repos/)).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: /Get Started/ }));

    expect(api.closeWindow).toHaveBeenCalledOnce();
  });

  it("launches straight away when asked to during customization", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Customize Installation" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /I agree/ }));
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    fireEvent.click(await screen.findByRole("checkbox", { name: /Launch DevAtlas/ }));
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));

    expect(await screen.findByText("Ready to Get Started")).toBeInTheDocument();
    expect(api.launchApp).toHaveBeenCalledOnce();
  });

  it("explains why setup cannot start when the backend is unreachable", async () => {
    api.getInstallDefaults.mockRejectedValue(
      new Error("DevAtlas Setup must run as the desktop installer."),
    );
    render(<App />);

    await findAlert("must run as the desktop installer");
    expect(screen.getByRole("button", { name: "Install DevAtlas" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("uses the defaults for one-click install even after visiting Customize", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Customize Installation" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /I agree/ }));
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    fireEvent.change(await screen.findByDisplayValue(DIR), { target: { value: "" } });
    await findAlert("Choose a folder");
    fireEvent.click(screen.getByRole("button", { name: /Back/ }));
    expect(screen.getByRole("checkbox", { name: /I agree/ })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Install DevAtlas" }));
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));

    await screen.findByText("Installation Complete!");
    expect(api.install).toHaveBeenCalledWith(
      expect.objectContaining({ dir: DIR, desktopShortcut: true }),
      expect.any(Function),
    );
  });

  it("stays on Complete with the reason when DevAtlas fails to start", async () => {
    api.launchApp.mockRejectedValueOnce(new Error("Could not start DevAtlas: denied"));
    render(<App />);
    await acceptLicense();

    fireEvent.click(await screen.findByRole("button", { name: /Launch DevAtlas/ }));

    await findAlert("Could not start DevAtlas");
    expect(screen.getByText("Installation Complete!")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Launch DevAtlas/ })).toBeEnabled();
  });

  it("shows where the user is in setup, with Options only when customizing", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Customize Installation" }));
    expect(screen.getByRole("list", { name: "Setup progress" })).toHaveTextContent("Options");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Install DevAtlas" }));

    expect(screen.getByRole("list", { name: "Setup progress" })).not.toHaveTextContent("Options");
  });

  it("moves focus to each new screen's heading", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Install DevAtlas" }));

    expect(screen.getByRole("heading", { name: "License Agreement" })).toHaveFocus();
  });

  it("moves focus back to the heading when retrying a failed install", async () => {
    api.install.mockRejectedValueOnce(new Error("Could not write C:\\x: Access is denied."));
    api.install.mockReturnValueOnce(new Promise(() => {}));
    render(<App />);
    await acceptLicense();

    await findAlert("Access is denied.");
    const retry = screen.getByRole("button", { name: "Try again" });
    retry.focus();
    fireEvent.click(retry);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Installing DevAtlas" })).toHaveFocus();
    });
  });

  it("shows install progress", async () => {
    api.install.mockImplementation((_options, onProgress) => {
      onProgress({ step: "configuring", percent: 72 });
      return new Promise(() => {});
    });
    render(<App />);

    await acceptLicense();

    expect(
      await screen.findByRole("progressbar", { name: "Installation progress" }),
    ).toHaveAttribute("aria-valuenow", "72");
    expect(screen.getByText("Installing… 72%")).toBeInTheDocument();
  });
});
