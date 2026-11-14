import { OCTOCAT } from "./fake-backend";
import { expect, test } from "./test";

test("deleting the Community account confirms first, then signs out", async ({ page, launch }) => {
  const backend = await launch({ user: OCTOCAT }, "/settings");

  await page.getByRole("button", { name: "Delete Community account" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete your Community account?" });
  await expect(dialog.getByRole("list", { name: "Removed from Community" })).toBeVisible();
  expect(backend.callsTo("delete_community_account")).toHaveLength(0);

  await dialog.getByRole("button", { name: "Delete account" }).click();

  await expect(page.getByText("Your Community account was deleted")).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(/^Not signed in\./)).toBeVisible();
  const sidebar = page.getByRole("navigation", { name: "Primary" });
  await expect(sidebar.getByRole("button", { name: "Sign in with GitHub" })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: OCTOCAT.username })).toHaveCount(0);
  expect(backend.callsTo("delete_community_account")).toHaveLength(1);
});
