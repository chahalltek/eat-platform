import { describe, test, vi } from "vitest";

const testWithIntegration = test as typeof test & {
  integration: typeof test.skip;
};

const describeWithIntegration = describe as typeof describe & {
  integration: typeof describe.skip;
};

testWithIntegration.integration = test.skip;
describeWithIntegration.integration = describe.skip;

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
