import fs from "node:fs";
import path from "node:path";

<<<<<<< ours
import { expect, test as setup } from "../playwright-coverage";
=======
import { expect, test as setup } from "@bgotink/playwright-coverage";
>>>>>>> theirs

import { AUTH_STORAGE_STATE } from "../playwrightAuth";

setup("authenticate", async ({ page, baseURL }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!baseURL) {
    throw new Error("baseURL is not configured; set ADMIN_SWEEP_BASE_URL or use Playwright baseURL.");
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

  expect(response.ok()).toBeTruthy();

  await page.context().storageState({ path: AUTH_STORAGE_STATE });
});
