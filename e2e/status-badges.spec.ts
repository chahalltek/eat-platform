<<<<<<< ours
import { expect, test } from "./testBase";
=======
import { expect, test } from "../tests/e2e/fixtures";
>>>>>>> theirs

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
