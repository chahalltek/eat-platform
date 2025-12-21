import fs from "node:fs";
import path from "node:path";

import { expect, test as setup } from "@playwright/test";

import { AUTH_STORAGE_STATE } from "../tests/playwrightAuth";

setup("authenticate", async ({ page, baseURL }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!baseURL) {
    throw new Error("baseURL is not configured; set E2E_BASE_URL or use Playwright baseURL.");
  }

  if (!email || !password) {
    throw new Error("E2E_EMAIL and E2E_PASSWORD must be set for authenticated Playwright runs.");
  }

  await fs.promises.mkdir(path.dirname(AUTH_STORAGE_STATE), { recursive: true });

  const response = await page.request.post("/api/auth/login", {
    data: {
      email,
      password,
    },
  });

  if (!response.ok()) {
    const message = await response.text();
    throw new Error(`Authentication failed: ${response.status()} ${message}`);
  }

  await page.context().storageState({ path: AUTH_STORAGE_STATE });
  await expect(response.ok()).toBeTruthy();
});
