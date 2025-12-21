import { expect, test } from "@playwright/test";

test.describe("Status badges showcase", () => {
  test("renders the visual gallery without authentication", async ({ page }) => {
    await page.goto("/visual/status-badges");

    const gallery = page.getByTestId("status-badge-gallery");
    await expect(gallery).toBeVisible();

    const expectedStatuses = ["Healthy", "Informational", "Needs attention", "Action required", "Idle"];
    for (const label of expectedStatuses) {
      await expect(gallery.getByText(label)).toBeVisible();
    }
  });
});
