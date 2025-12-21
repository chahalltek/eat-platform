import { expect, type Locator, type Page, test } from "@playwright/test";

type RouteCheck = {
  path: string;
  locator: (page: Page) => Locator;
  afterVisit?: (page: Page) => Promise<void>;
};

const ROUTES: RouteCheck[] = [
  { path: "/admin", locator: (page) => page.getByTestId("admin-health-page") },
  { path: "/admin/env", locator: (page) => page.getByRole("heading", { level: 1, name: /environment overview/i }) },
  { path: "/admin/security-events", locator: (page) => page.getByRole("heading", { level: 1, name: /security events/i }) },
  { path: "/admin/tenants", locator: (page) => page.getByRole("heading", { level: 1, name: /tenants & plans/i }) },
  { path: "/admin/ete/catalog", locator: (page) => page.getByTestId("admin-catalog-page") },
  { path: "/admin/ete/tests", locator: (page) => page.getByRole("heading", { level: 1, name: /on-demand test runner/i }) },
  { path: "/fulfillment", locator: (page) => page.getByRole("heading", { level: 1, name: /observability/i }) },
  { path: "/jobs", locator: (page) => page.getByTestId("jobs-page") },
  { path: "/agents/runs", locator: (page) => page.getByRole("heading", { level: 1, name: /agent runs/i }) },
  { path: "/agents/logs", locator: (page) => page.getByRole("heading", { level: 1, name: /agent activity logs/i }) },
];

async function expectRouteLoaded(page: Page, route: RouteCheck) {
  const response = await page.goto(route.path);

  if (response && response.status() >= 400) {
    const body = await response.text();
    throw new Error(`Route ${route.path} failed to load: ${response.status()} ${body}`);
  }

  await expect(route.locator(page)).toBeVisible();

  if (route.afterVisit) {
    await route.afterVisit(page);
  }
}

test.describe.configure({ mode: "serial" });

test.describe("authenticated routes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
  });

  for (const route of ROUTES) {
    test(`loads ${route.path}`, async ({ page }) => {
      await expectRouteLoaded(page, route);
    });
  }
});
