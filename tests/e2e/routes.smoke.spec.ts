import { expect, type Locator, type Page, test } from "@playwright/test";

type RouteExpectation = {
  path: string;
  expectedPath?: string;
  locator: (page: Page) => Locator;
};

const ROUTES: RouteExpectation[] = [
  {
    path: "/",
    locator: (page) => page.getByRole("heading", { level: 1 }),
  },
  {
    path: "/about",
    expectedPath: "/system-map",
    locator: (page) => page.getByRole("heading", { level: 1, name: /data flow blueprint/i }),
  },
  {
    path: "/help",
    locator: (page) => page.getByRole("heading", { level: 1, name: /quick answers/i }),
  },
  {
    path: "/health",
    locator: (page) => page.getByRole("heading", { level: 1, name: /system status/i }),
  },
  {
    path: "/ete/about",
    expectedPath: "/ete/system-map",
    locator: (page) => page.getByRole("heading", { level: 1, name: /data flow blueprint/i }),
  },
  {
    path: "/visual/status-badges",
    locator: (page) => page.getByTestId("status-badge-gallery"),
  },
];

test.describe("public route smoke tests", () => {
  for (const route of ROUTES) {
    test(`renders ${route.path} with stable content`, async ({ baseURL, page }) => {
      const fallbackBaseUrl = baseURL ?? "http://127.0.0.1:3000";
      const expectedUrl = new URL(route.expectedPath ?? route.path, fallbackBaseUrl).toString();

      await page.goto(route.path);

      await expect(page).toHaveURL(expectedUrl);
      await expect(route.locator(page)).toBeVisible();
    });
  }
});
