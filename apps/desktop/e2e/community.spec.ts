import { SHARED_COLLECTION } from "./fake-backend";
import { expect, test } from "./test";

test.describe("Community", () => {
  test("is gated behind sign-in and fetches nothing while signed out", async ({ page, launch }) => {
    const backend = await launch({ user: null }, "/community");

    const gate = page.getByRole("region", { name: "Sign in to browse Community" });
    await expect(gate).toBeVisible();
    await expect(page.getByRole("heading", { name: "Community", exact: true })).toHaveCount(0);
    expect(backend.callsTo("list_shared_collections")).toHaveLength(0);

    await gate.getByRole("button", { name: "Sign in with GitHub" }).click();

    await expect(page.getByRole("heading", { name: "Community", exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: new RegExp(SHARED_COLLECTION.title) }),
    ).toBeVisible();
    expect(backend.callsTo("community_sign_in")).toHaveLength(1);
    // Nothing was listed before the account existed: the first list call follows the sign-in.
    const commands = backend.calls.map((call) => call.command);
    expect(commands.indexOf("list_shared_collections")).toBeGreaterThan(
      commands.indexOf("community_sign_in"),
    );
  });

  test("a shared collection lists its links privately, and can be followed and saved from", async ({
    page,
    launch,
  }) => {
    const backend = await launch({ user: null }, "/community");
    await page
      .getByRole("region", { name: "Sign in to browse Community" })
      .getByRole("button", { name: "Sign in with GitHub" })
      .click();
    // The card's link sits under its content, which takes the click, as a mouse user's would.
    await page.getByRole("heading", { name: SHARED_COLLECTION.title }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: SHARED_COLLECTION.title }),
    ).toBeVisible();
    for (const link of SHARED_COLLECTION.links) {
      await expect(page.getByRole("link", { name: link.title })).toBeVisible();
    }
    // Privacy: fetching previews of someone else's links would tell their sites who looked.
    // Checked again at the end, after several more round trips have let any effect run.
    expect(backend.callsTo("get_resource_preview")).toEqual([]);

    const follow = page.getByRole("button", { name: /^Follow(ing)?, \d+ followers?$/ });
    await expect(follow).toHaveAccessibleName("Follow, 3 followers");
    await expect(follow).toHaveAttribute("aria-pressed", "false");
    await follow.click();
    await expect(follow).toHaveAccessibleName("Following, 4 followers");
    await expect(follow).toHaveAttribute("aria-pressed", "true");
    expect(backend.callsTo("follow_shared_collection")).toEqual([
      { command: "follow_shared_collection", args: { id: SHARED_COLLECTION.id } },
    ]);

    const [first] = SHARED_COLLECTION.links;
    if (first === undefined) throw new Error("The fixture collection needs a link.");
    await page.getByRole("button", { name: `Save ${first.title} to your library` }).click();
    await expect(
      page.getByRole("button", { name: `${first.title} is in your library` }),
    ).toBeVisible();
    expect(backend.callsTo("add_link")).toEqual([
      { command: "add_link", args: { url: first.url } },
    ]);
    expect(backend.callsTo("get_resource_preview")).toEqual([]);
  });
});
