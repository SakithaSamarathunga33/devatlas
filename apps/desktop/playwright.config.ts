import { defineConfig, devices } from "@playwright/test";

const isCi = Boolean(process.env.CI);
// Not Tauri's 1420, so the suite never reuses (or collides with) a running `pnpm dev`.
const PORT = 1430;
const baseURL = `http://localhost:${String(PORT)}`;

/** E2E: the real React UI in Chromium, with the Rust backend replaced by e2e/fake-backend.ts. */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm exec vite --port ${String(PORT)} --strictPort`,
    url: baseURL,
    reuseExistingServer: !isCi,
    timeout: 120_000,
  },
});
