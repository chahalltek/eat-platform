import { expect, test } from "@playwright/test";

import { AUTH_STORAGE_STATE } from "../tests/playwrightAuth";

const MIN_ADMIN_ROUTES = 8;
const STATIC_ADMIN_ROUTES = [
  "/admin",
  "/admin/cost",
  "/admin/usage",
  "/admin/feature-flags",
  "/admin/guardrails",
  "/admin/env",
  "/admin/security-events",
  "/admin/quality",
  "/admin/ete/tests",
  "/admin/tenants",
];

test.use({ storageState: AUTH_STORAGE_STATE });

function isSkippableRoute(href: string) {
  return (
    href.startsWith("http") ||
    href.startsWith("//") ||
    href.startsWith("#") ||
    href.includes("[") ||
    href.includes("]") ||
    href.includes(":")
  );
}

function escapeForRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test.describe("admin navigation crawl", () => {
  test("visits admin nav routes without errors", async ({ baseURL, page }) => {
    if (!baseURL) {
      throw new Error("baseURL is not configured; set E2E_BASE_URL or use Playwright baseURL.");
    }

    await page.goto("/admin");

    const navLinks =
      (await page.getByTestId("admin-nav").locator('a[href^="/admin"]').all()).length > 0
        ? await page.getByTestId("admin-nav").locator('a[href^="/admin"]').all()
        : await page.locator('nav a[href^="/admin"]').all();

    const discoveredRoutes = new Set<string>(STATIC_ADMIN_ROUTES);

    for (const link of navLinks) {
      const href = await link.getAttribute("href");
      if (!href || isSkippableRoute(href)) continue;
      const normalized = href.startsWith("/") ? href : `/${href}`;
      discoveredRoutes.add(normalized);
    }

    const adminRoutes = Array.from(discoveredRoutes);
    expect(
      adminRoutes.length,
      `Expected at least ${MIN_ADMIN_ROUTES} admin routes to crawl, found ${adminRoutes.length}.`,
    ).toBeGreaterThanOrEqual(MIN_ADMIN_ROUTES);

    for (const route of adminRoutes) {
      const targetUrl = new URL(route, baseURL).toString();

      const response = await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
      expect(response?.ok(), `Navigation to ${route} failed`).toBeTruthy();

      await expect(page.locator("main")).toBeVisible();
      await expect(page).toHaveURL(new RegExp(escapeForRegex(new URL(route, baseURL).pathname)));
      await expect(page.getByText(/Not Authorized/i)).toHaveCount(0);
      await expect(page.getByText(/Access denied/i)).toHaveCount(0);
      await expect(page.getByText(/Something went wrong/i)).toHaveCount(0);
    }
  });
});
