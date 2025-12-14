import { describe, test, vi } from "vitest";

declare module "vitest" {
  interface SuiteAPI {
    integration: typeof describe.skip;
  }

  interface TestAPI {
    integration: typeof test.skip;
  }
}

test.integration = test.skip;
describe.integration = describe.skip;

vi.mock("@/lib/auth/requireRole", async () => {
  const actual = await vi.importActual<any>("@/lib/auth/requireRole");

  return {
    ...actual,
    requireRecruiterOrAdmin: vi.fn(async () => ({
      ok: true,
      user: { id: "test-user", role: "RECRUITER" },
    })),
    requireHiringManagerOrAdmin: vi.fn(async () => ({
      ok: true,
      user: { id: "test-user", role: "MANAGER" },
    })),
    requireRole: vi.fn(async () => ({
      ok: true,
      user: { id: "test-user", role: "RECRUITER" },
    })),
  };
});
