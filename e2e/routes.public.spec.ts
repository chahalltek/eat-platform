import { expect, type Locator, type Page, test } from "@playwright/test";

type RouteSpec = {
  path: string;
  expectedPath?: string;
  stableLocators?: Array<(page: Page) => Locator>;
};

const defaultHeaders = {
  "x-eat-user-id": process.env.E2E_USER_ID ?? "routes-public-user",
  "x-eat-user-role": process.env.E2E_USER_ROLE ?? "ADMIN",
  "x-eat-tenant-id": process.env.E2E_TENANT_ID ?? "routes-public-tenant",
};

test.use({ extraHTTPHeaders: defaultHeaders });

async function gotoAndExpectOk(page: Page, route: string) {
  const preflightResponse = await page.request.get(route);
  expect(preflightResponse.status(), `Preflight GET for ${route} should return 200`).toBe(200);

  const navigationResponse = await page.goto(route);
  expect(navigationResponse, `Navigation response missing for ${route}`).not.toBeNull();
  expect(navigationResponse?.status(), `Navigation to ${route} should succeed`).toBe(200);
}

async function expectStableSelector(page: Page, spec: RouteSpec) {
  const candidates = [
    ...(spec.stableLocators ?? []),
    (ctx: Page) => ctx.getByTestId("page-root"),
    (ctx: Page) => ctx.locator("main"),
    (ctx: Page) => ctx.getByRole("heading", { level: 1 }),
  ];

  for (const getLocator of candidates) {
    const locator = getLocator(page);
    const count = await locator.count();

    if (count > 0) {
      await expect(locator.first(), `Stable selector should be visible for ${spec.path}`).toBeVisible();
      return;
    }
  }

  throw new Error(`No stable selectors rendered for ${spec.path}`);
}

const ROUTES: RouteSpec[] = [
  {
    path: "/",
    stableLocators: [(page) => page.getByRole("heading", { level: 1 })],
  },
  {
    path: "/about",
    expectedPath: "/system-map",
    stableLocators: [(page) => page.getByRole("heading", { level: 1, name: /data flow blueprint/i })],
  },
  {
    path: "/help",
    stableLocators: [(page) => page.getByRole("heading", { level: 1, name: /quick answers about ete/i })],
  },
  {
    path: "/health",
    stableLocators: [(page) => page.getByRole("heading", { level: 1, name: /system status/i })],
  },
  {
    path: "/ete/about",
    expectedPath: "/ete/system-map",
    stableLocators: [(page) => page.getByRole("heading", { level: 1, name: /data flow blueprint/i })],
  },
  {
    path: "/ete/system-map",
    stableLocators: [(page) => page.getByRole("heading", { level: 1, name: /data flow blueprint/i })],
  },
  {
    path: "/ete/operations-runbook",
    stableLocators: [(page) => page.getByRole("heading", { level: 1, name: /operations runbook/i })],
  },
  {
    path: "/visual/status-badges",
    stableLocators: [(page) => page.getByTestId("status-badge-gallery")],
  },
  {
    path: "/test-day",
    stableLocators: [(page) => page.getByRole("heading", { level: 1, name: /test day/i })],
  },
  {
    path: "/dev/table-demo",
    stableLocators: [(page) => page.getByRole("heading", { level: 1, name: /tanstack table demo/i })],
  },
];

test.describe("public route coverage", () => {
  for (const spec of ROUTES) {
    test(`renders ${spec.path}`, async ({ baseURL, page }) => {
      await gotoAndExpectOk(page, spec.path);

      const fallbackBaseUrl = baseURL ?? "http://127.0.0.1:3000";
      const expectedUrl = new URL(spec.expectedPath ?? spec.path, fallbackBaseUrl).toString();
      await expect(page, `Expected final URL ${expectedUrl} for ${spec.path}`).toHaveURL(expectedUrl);

      await expectStableSelector(page, spec);
    });
  }
});
