import { NEWER_RELEASE } from "./fake-backend";
import { expect, test } from "./test";

test.describe("updates", () => {
  test("a newer release is offered in the sidebar and installs on click", async ({
    page,
    launch,
  }) => {
    const backend = await launch({ update: NEWER_RELEASE });
    const sidebar = page.getByRole("navigation", { name: "Primary" });

    await sidebar.getByRole("button", { name: `Update to ${NEWER_RELEASE.tag}` }).click();

    // The real backend restarts the app on success; until then the item reports progress.
    await expect(sidebar.getByRole("button", { name: "Updating…" })).toBeDisabled();
    expect(backend.callsTo("install_update")).toHaveLength(1);
  });

  test("checking by hand with no newer release says DevAtlas is up to date", async ({
    page,
    launch,
  }) => {
    const backend = await launch({ update: null });
    const sidebar = page.getByRole("navigation", { name: "Primary" });
    const check = sidebar.getByRole("button", { name: "Check for updates" });
    await expect(check).toBeEnabled();
    const checksAtStart = backend.callsTo("check_for_update").length;

    await check.click();

    await expect(page.getByText("DevAtlas is up to date")).toBeVisible();
    expect(backend.callsTo("check_for_update").length).toBe(checksAtStart + 1);
    expect(backend.callsTo("install_update")).toHaveLength(0);
  });
});
