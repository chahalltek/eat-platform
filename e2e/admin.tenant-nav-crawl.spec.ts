import fs from "node:fs";
import path from "node:path";

import { expect, type APIRequestContext, type Page, test } from "@playwright/test";

import { AUTH_STORAGE_STATE } from "../tests/playwrightAuth";

const TENANT_ROUTE_SEGMENTS = [
  "",
  "/diagnostics",
  "/guardrails",
  "/operations-runbook",
  "/ops/runtime-controls",
  "/ops/test-runner",
  "/ops/test-runner/ete",
  "/runtime",
  "/ats-sync",
];

type TenantResolution =
  | {
      source: "api" | "ui";
      tenantId: string;
    }
  | null;

const optionalRoutePredicate = (route: string) => route.endsWith("/ats-sync");

const hasAdminAuthError = (status: number) => status === 401 || status === 403;

const normalizeTenantId = (tenantId: string) => tenantId.trim();

const collectTenantIds = (payload: unknown): string[] => {
  if (!payload) return [];

  if (Array.isArray(payload)) {
    return payload.flatMap((item) => collectTenantIds(item));
  }

  if (typeof payload !== "object") {
    return [];
  }

  const obj = payload as Record<string, unknown>;
  const directIds = [obj.id, obj.tenantId].filter((value): value is string => typeof value === "string").map(normalizeTenantId);
  const preferredKeys = ["tenants", "items", "data", "results"];
  const preferredNestedIds = preferredKeys.flatMap((key) => collectTenantIds(obj[key]));
  const fallbackNestedIds =
    preferredNestedIds.length > 0 ? [] : Object.values(obj).flatMap((value) => collectTenantIds(value));

  return [...new Set([...directIds, ...preferredNestedIds, ...fallbackNestedIds])];
};

const resolveTenantFromApi = async (request: APIRequestContext): Promise<TenantResolution> => {
  const response = await request.get("/api/admin/tenants");

  if (hasAdminAuthError(response.status())) {
    throw new Error("E2E user lacks tenant admin permissions");
  }

  if (!response.ok()) {
    return null;
  }

  const payload = await response.json();
  const tenantIds = collectTenantIds(payload);
  if (!tenantIds.length) {
    return null;
  }

  const preferredTenantId = tenantIds.find((id) => id === "default-tenant") ?? tenantIds[0];
  return { source: "api", tenantId: preferredTenantId };
};

const resolveTenantFromUi = async (page: Page): Promise<TenantResolution> => {
  await page.goto("/admin/tenants", { waitUntil: "domcontentloaded" });

  const unauthorizedCount = await page.getByText(/not authorized/i).count();
  if (unauthorizedCount > 0) {
    throw new Error("E2E user lacks tenant admin permissions");
  }

  const firstTenantLink = page.locator('a[href*="/admin/tenant/"]').first();
  const href = await firstTenantLink.getAttribute("href");

  if (!href) {
    return null;
  }

  const match = href.match(/\/admin\/tenant\/([^/]+)/);
  const tenantId = match?.[1];

  if (!tenantId) {
    return null;
  }

  return { source: "ui", tenantId };
};

const assertAuthorizedPage = async (page: Page) => {
  await expect(page.locator("text=Not Authorized")).toHaveCount(0);
  await expect(page.locator("text=Access denied")).toHaveCount(0);
  await expect(page.locator("text=Something went wrong")).toHaveCount(0);
};

test.use({ storageState: AUTH_STORAGE_STATE });

test.beforeAll(async ({ baseURL, browser }) => {
  if (fs.existsSync(AUTH_STORAGE_STATE)) {
    return;
  }

  if (!baseURL) {
    throw new Error("baseURL is not configured; set PLAYWRIGHT_BASE_URL or use Playwright baseURL.");
  }

  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error("E2E_EMAIL and E2E_PASSWORD must be set or an authenticated storage state must be provided.");
  }

  await fs.promises.mkdir(path.dirname(AUTH_STORAGE_STATE), { recursive: true });

  const authContext = await browser.newContext({ baseURL });
  const authPage = await authContext.newPage();
  const response = await authPage.request.post("/api/auth/login", { data: { email, password } });

  expect(response.ok()).toBeTruthy();

  await authContext.storageState({ path: AUTH_STORAGE_STATE });
  await authContext.close();
});

test.describe("tenant admin navigation crawl", () => {
  test("resolves tenant id then visits tenant-scoped admin routes", async ({ baseURL, page, request }) => {
    if (!baseURL) {
      throw new Error("baseURL is not configured; set PLAYWRIGHT_BASE_URL or use Playwright baseURL.");
    }

    const tenantResolution = (await resolveTenantFromApi(request)) ?? (await resolveTenantFromUi(page));
    const tenantId = tenantResolution?.tenantId;

    if (!tenantId) {
      test.skip(true, "No tenants available to crawl for admin coverage.");
    }

    test.info().annotations.push({
      type: "tenant",
      description: `Resolved tenantId=${tenantId} via ${tenantResolution?.source ?? "unknown"}`,
    });
    // eslint-disable-next-line no-console
    console.info(`Resolved tenantId for admin crawl: ${tenantId} (source=${tenantResolution?.source ?? "unknown"})`);

    const tenantRoutes = TENANT_ROUTE_SEGMENTS.map((segment) => `/admin/tenant/${tenantId}${segment}`);

    let successfulRoutes = 0;

    for (const route of tenantRoutes) {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });

      if (response && hasAdminAuthError(response.status())) {
        throw new Error("E2E user lacks tenant admin permissions");
      }

      if (response && optionalRoutePredicate(route) && response.status() === 404) {
        continue;
      }

      expect(response?.ok()).toBeTruthy();

      await expect(page.locator("main")).toBeVisible();
      await assertAuthorizedPage(page);

      successfulRoutes += 1;
    }

    expect(successfulRoutes).toBeGreaterThanOrEqual(6);
  });
});
