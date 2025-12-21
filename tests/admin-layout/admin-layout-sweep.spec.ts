import { expect, test } from "../playwright-coverage";

const SWEEP_PATHS = [
  "/admin",
  "/admin/agents",
  "/admin/console",
  "/admin/tenant",
  "/admin/tenant/default/operations-runbook",
  "/admin/tenant/default/presets",
  "/admin/tenant/default/workflows",
];

test.describe.configure({ mode: "parallel" });

test.describe("admin layout sweep", () => {
  for (const path of SWEEP_PATHS) {
    test(`loads ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("banner")).toBeVisible();
    });
  }
});
