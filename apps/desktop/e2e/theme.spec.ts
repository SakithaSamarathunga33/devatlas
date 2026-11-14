import { expect, test } from "./test";

test("the theme toggle switches dark and light through a view transition", async ({
  page,
  launch,
}) => {
  await launch();
  const root = page.locator("html");
  // Chromium has the View Transitions API, so the animated path runs, not the instant fallback.
  expect(await page.evaluate(() => typeof document.startViewTransition)).toBe("function");
  await expect(root).toHaveAttribute("data-theme", "dark");

  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(root).toHaveAttribute("data-theme", "light");
  await expect(root).not.toHaveClass(/\bdark\b/);
  // A click while the reveal still runs is ignored by design; wait for it to finish.
  await expect(root).not.toHaveAttribute("data-theme-reveal");

  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(root).toHaveClass(/\bdark\b/);
  await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
});
