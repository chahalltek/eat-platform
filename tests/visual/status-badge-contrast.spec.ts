import { expect, test } from "../playwright-coverage";

const BADGES = ["healthy", "informational", "needs-attention", "action-required", "idle"] as const;

test.describe("status badge contrast", () => {
  for (const badge of BADGES) {
    test(`renders ${badge} badge with contrast tokens`, async ({ page }) => {
      await page.goto(`/visual/status-badge-contrast/${badge}`);

      const badgeElement = page.getByTestId(`status-badge-${badge}`);
      await expect(badgeElement).toBeVisible();
      await expect(badgeElement).toHaveAttribute("data-contrast", "true");
    });
  }
});
