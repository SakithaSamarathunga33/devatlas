import { OCTOCAT, resource } from "./fake-backend";
import { expect, test } from "./test";

const GROUP_ID = "group-1";

test("sharing a collection previews the cleaned links, then publishes it", async ({
  page,
  launch,
}) => {
  const backend = await launch(
    {
      user: OCTOCAT,
      library: [
        resource(
          "ui.example.com/kit",
          "https://ui.example.com/kit?utm_source=feed#install",
          "UI kit",
        ),
        resource("docs.example.com/guide", "https://docs.example.com/guide?token=s3cret", "Guide"),
        resource("plain.example.com", "http://plain.example.com/", "Plain HTTP site"),
      ],
      groups: [
        {
          id: GROUP_ID,
          name: "Frontend kit",
          description: "Everything for a new UI.",
          resourceIds: ["ui.example.com/kit", "docs.example.com/guide", "plain.example.com"],
          createdAt: 1_700_000_000_000,
        },
      ],
    },
    "/collections",
  );

  await page.getByRole("heading", { name: "Frontend kit" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Frontend kit" })).toBeVisible();
  await page.getByRole("button", { name: "Share to Community" }).click();

  const dialog = page.getByRole("dialog", { name: "Share to Community" });
  // The Rust backend strips queries and fragments (unit-tested there; mirrored by the fake):
  // this checks the dialog shows exactly the preview it was given, never the saved addresses.
  const links = dialog.getByRole("list", { name: "Links that will be shared" });
  await expect(links.getByRole("listitem")).toHaveCount(2);
  await expect(links).toContainText("ui.example.com/kit");
  await expect(links).toContainText("docs.example.com/guide");
  await expect(links).not.toContainText("?");
  await expect(links).not.toContainText("#");
  await expect(links).not.toContainText("s3cret");
  await expect(dialog).toContainText("1 link isn't https and will be left out.");

  await dialog.getByRole("button", { name: "Publish" }).click();

  await expect(page.getByText("Shared to Community")).toBeVisible();
  await expect(dialog).toBeHidden();
  expect(backend.callsTo("share_group")).toEqual([
    { command: "share_group", args: { groupId: GROUP_ID } },
  ]);
});
