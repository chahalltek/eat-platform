import { expect, test } from "../playwright-coverage";

const PRESETS = ["ops-guardrails", "dev-guardrails"] as const;

test.describe.configure({ mode: "parallel" });

test.describe("guardrails preset visuals", () => {
  for (const preset of PRESETS) {
    test(`renders preset ${preset}`, async ({ page }) => {
      await page.goto(`/visual/guardrails/${preset}`);

      await expect(page.getByRole("heading", { level: 1, name: /guardrails/i })).toBeVisible();
      await expect(page.getByTestId("guardrails-preset-grid")).toBeVisible();
    });
  }
});
