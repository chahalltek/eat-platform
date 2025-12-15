import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { DEFAULT_TENANT_ID } from "../../src/lib/auth/config";

const ADMIN_EMAIL = process.env.ADMIN_SWEEP_EMAIL ?? "admin@test.demo";
const ADMIN_PASSWORD =
  process.env.ADMIN_SWEEP_PASSWORD ?? process.env.AUTH_PASSWORD ?? process.env.AUTH_PASSWORD_LOCAL ?? "password";

const VIEWPORTS = [
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];

const ROUTES = [
  "/admin",
  "/admin/guardrails",
  "/admin/quality",
  "/admin/cost",
  "/admin/usage",
  "/admin/feature-flags",
  "/admin/env",
  "/admin/security-events",
  "/admin/tenant",
  "/admin/tenants",
  `/admin/tenants/${DEFAULT_TENANT_ID}`,
];

test.beforeEach(async ({ page, baseURL }) => {
  if (!baseURL) {
    throw new Error("baseURL is not configured; set ADMIN_SWEEP_BASE_URL or use Playwright baseURL.");
  }

  const response = await page.request.post("/api/auth/login", {
    data: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    },
  });

  expect(response.ok()).toBeTruthy();
});

test("admin layout sweep captures screenshots and checks overflow", async ({ page }, testInfo) => {
  const screenshotDir = path.join(testInfo.outputDir, "screenshots");
  fs.mkdirSync(screenshotDir, { recursive: true });

  for (const route of ROUTES) {
    const slug = route.replace(/[\\/]+/g, "-").replace(/^-+|-+$/g, "") || "root";

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      const response = await page.goto(route, { waitUntil: "networkidle" });
      expect(response?.ok()).toBeTruthy();

      const hasHorizontalOverflow = await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth > root.clientWidth;
      });

      expect(hasHorizontalOverflow, `${route} overflows horizontally at ${viewport.width}px`).toBeFalsy();

      const screenshotPath = path.join(screenshotDir, `${slug}-${viewport.width}w.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }
  }
});
