import { OCTOCAT } from "./fake-backend";
import { expect, test } from "./test";

const GREETING = /^Good (morning|afternoon|evening)$/;

test.describe("first launch", () => {
  test("using DevAtlas locally saves the choice and opens the dashboard", async ({
    page,
    launch,
  }) => {
    const backend = await launch({ onboarded: false });

    await expect(page.getByRole("heading", { name: "Welcome to DevAtlas" })).toBeVisible();
    await page.getByRole("button", { name: "Use DevAtlas locally" }).click();

    await expect(page.getByRole("heading", { level: 1, name: GREETING })).toBeVisible();
    expect(backend.callsTo("complete_onboarding")).toHaveLength(1);
    expect(backend.callsTo("community_sign_in")).toHaveLength(0);

    const sidebar = page.getByRole("navigation", { name: "Primary" });
    for (const section of ["Library", "Discover", "Community"]) {
      await expect(sidebar.getByText(section, { exact: true }).first()).toBeVisible();
    }
    for (const pageName of ["Dashboard", "Collections", "Community", "Settings"]) {
      await expect(sidebar.getByRole("link", { name: pageName })).toBeVisible();
    }
    await expect(sidebar.getByRole("button", { name: "Sign in with GitHub" })).toBeVisible();
  });

  test("continuing with GitHub signs in and shows the account in the sidebar", async ({
    page,
    launch,
  }) => {
    const user = { ...OCTOCAT, username: "a-very-long-github-name" };
    const backend = await launch({ onboarded: false, signInUser: user });

    await page.getByRole("button", { name: "Continue with GitHub" }).click();

    await expect(page.getByRole("heading", { level: 1, name: GREETING })).toBeVisible();
    expect(backend.callsTo("community_sign_in")).toHaveLength(1);
    expect(backend.callsTo("complete_onboarding")).toHaveLength(1);

    const sidebar = page.getByRole("navigation", { name: "Primary" });
    // Names past 14 characters are cut to 13 and an ellipsis; the full name stays accessible.
    const account = sidebar.getByRole("link", { name: user.username });
    await expect(account).toHaveText("a-very-long-g…");
    await expect(sidebar.getByRole("button", { name: "Sign out" })).toBeVisible();
  });
});
