<<<<<<< ours
import { expect, test } from "../playwright-coverage";
=======
import { expect, test } from "@bgotink/playwright-coverage";
>>>>>>> theirs

test.describe("status badge contrast", () => {
  test.use({
    viewport: { width: 1280, height: 720 },
  });

  test("variants stay legible in light and dark mode", async ({ page, baseURL }, testInfo) => {
    if (!baseURL) {
      throw new Error("baseURL is not configured; set VISUAL_BASE_URL or use Playwright baseURL.");
    }

    await page.emulateMedia({ reducedMotion: "reduce" });
    const response = await page.goto("/visual/status-badges", { waitUntil: "networkidle" });
    expect(response?.ok()).toBeTruthy();

    const gallery = page.getByTestId("status-badge-gallery");
    await expect(gallery).toBeVisible();

    await expect(gallery).toHaveScreenshot(`status-badges-${testInfo.project.name}.png`, {
      animations: "disabled",
    });
  });
});
