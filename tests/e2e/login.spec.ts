import { expect, test } from "@playwright/test";

test.describe("login page branding", () => {
  test("renders sign-in state without console links", async ({ page, baseURL }) => {
    if (!baseURL) {
      throw new Error("baseURL is not configured; set E2E_BASE_URL or use Playwright baseURL.");
    }

    const response = await page.goto("/login", { waitUntil: "networkidle" });
    expect(response?.ok()).toBeTruthy();

    await expect(page.getByRole("heading", { name: /sign in to/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();

    const logo = page.getByRole("img", { name: /logo/i });
    await expect(logo).toBeVisible();

    const logoSrc = await logo.getAttribute("src");
    expect(logoSrc).toBeTruthy();
    expect(logoSrc?.includes("/public/")).toBeFalsy();
    expect(logoSrc?.endsWith("/ete-logo.svg")).toBeTruthy();

    await expect(page.getByText("Back to Console")).toHaveCount(0);
  });
});
