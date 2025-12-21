import { expect, test } from "@playwright/test";

import { DEFAULT_TENANT_ID } from "../../src/lib/auth/config";

const VIEWPORTS = [
  { width: 768, height: 960 },
  { width: 1024, height: 960 },
  { width: 1440, height: 960 },
];

test.beforeEach(({ baseURL }) => {
  if (!baseURL) {
    throw new Error("baseURL is not configured; set ADMIN_SWEEP_BASE_URL or use Playwright baseURL.");
  }
});

for (const viewport of VIEWPORTS) {
  test(`guardrails preset cards stay readable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const response = await page.goto(`/admin/tenant/${DEFAULT_TENANT_ID}/guardrails`, { waitUntil: "networkidle" });
    expect(response?.ok()).toBeTruthy();

    const pageShell = page.getByTestId("guardrails-presets-page");
    await expect(pageShell).toBeVisible();

    const presetPanel = pageShell.locator("section", { hasText: "Guardrail presets" }).first();
    await expect(presetPanel).toBeVisible();

    const presetTitles = presetPanel.locator("button span.text-sm.font-semibold.leading-tight.text-balance");
    await expect(presetTitles).toHaveCount(3);

    for (let index = 0; index < (await presetTitles.count()); index++) {
      const title = presetTitles.nth(index);
      await expect(title).toBeVisible();
      const hasOverflow = await title.evaluate((element) => element.scrollWidth > element.clientWidth);
      expect.soft(hasOverflow, "Preset title should not clip or overflow").toBeFalsy();
    }

    await expect(presetPanel).toHaveScreenshot(`guardrails-presets-${viewport.width}w.png`);
  });
}
