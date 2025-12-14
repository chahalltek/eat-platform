import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST, PUT } from "@/app/api/jobs/[jobReqId]/intent/route";
import { createNextRouteTestServer } from "@tests/test-utils/nextRouteTestServer";
import { withListeningServer } from "@tests/test-utils/serverHelpers";

const mocks = vi.hoisted(() => ({
  mockRequireRecruiterOrAdmin: vi.fn(),
  mockGetTenantScopedPrismaClient: vi.fn(),
}));

vi.mock("@/lib/auth/requireRole", () => ({ requireRecruiterOrAdmin: mocks.mockRequireRecruiterOrAdmin }));
vi.mock("@/lib/agents/tenantScope", () => ({
  getTenantScopedPrismaClient: mocks.mockGetTenantScopedPrismaClient,
  toTenantErrorResponse: () => null,
}));

function buildContext(jobReqId: string) {
  return { params: Promise.resolve({ jobReqId }) } as any;
}

const payload = {
  summary: "Data Scientist",
  requirements: [
    {
      id: "skill-python",
      type: "skill",
      label: "Python",
      normalizedLabel: "python",
      required: true,
      weight: 2,
      confidence: 0.95,
    },
  ],
  weightings: { skills: 1 },
  confidenceLevels: { requirements: 0.95 },
  metadata: { createdFrom: "manual", sourceDescription: "unit" },
};

describe("Job intent routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.mockRequireRecruiterOrAdmin.mockResolvedValue({ ok: true, user: { id: "user-7" } });
    mocks.mockGetTenantScopedPrismaClient.mockResolvedValue({
      tenantId: "tenant-1",
      prisma: {
        jobIntent: {
          findFirst: vi.fn().mockResolvedValue({ id: "intent-1", jobReqId: "job-55", tenantId: "tenant-1" }),
          upsert: vi.fn().mockResolvedValue({ id: "intent-1", jobReqId: "job-55", tenantId: "tenant-1", intent: payload }),
        },
      },
    });
  });

  it("creates a job intent via POST", async () => {
    const server = createNextRouteTestServer(POST, { buildContext: () => buildContext("job-55") });

    await withListeningServer(server, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/jobs/job-55/intent`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      expect(response.status).toBe(201);

      const body = await response.json();
      expect(body).toMatchObject({ id: "intent-1", jobReqId: "job-55", tenantId: "tenant-1" });
    });

    const prisma = (await mocks.mockGetTenantScopedPrismaClient.mock.results[0].value).prisma;

    expect(prisma.jobIntent.upsert).toHaveBeenCalledWith({
      where: { tenantId_jobReqId: { jobReqId: "job-55", tenantId: "tenant-1" } },
      update: {
        intent: expect.anything(),
        tenantId: "tenant-1",
        createdById: "user-7",
      },
      create: {
        jobReqId: "job-55",
        tenantId: "tenant-1",
        intent: expect.anything(),
        createdById: "user-7",
      },
    });
  });

  it("updates a job intent via PUT", async () => {
    const server = createNextRouteTestServer(PUT, { buildContext: () => buildContext("job-55") });

    await withListeningServer(server, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/jobs/job-55/intent`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payload }),
      });

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body).toMatchObject({ id: "intent-1", jobReqId: "job-55", tenantId: "tenant-1" });
    });
  });

  it("retrieves a job intent via GET", async () => {
    const server = createNextRouteTestServer(GET, { buildContext: () => buildContext("job-55") });

    await withListeningServer(server, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/jobs/job-55/intent`);

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body).toMatchObject({ id: "intent-1", jobReqId: "job-55", tenantId: "tenant-1" });

      const prisma = (await mocks.mockGetTenantScopedPrismaClient.mock.results[0].value).prisma;

      expect(prisma.jobIntent.findFirst).toHaveBeenCalledWith({
        where: { jobReqId: "job-55", tenantId: "tenant-1" },
      });
    });
  });

  it("rejects invalid payloads", async () => {
    const server = createNextRouteTestServer(POST, { buildContext: () => buildContext("job-55") });

    await withListeningServer(server, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/jobs/job-55/intent`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toBe("Invalid job intent payload");
    });
  });
});
