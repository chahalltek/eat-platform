import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { GET } from "./route";

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/auth/roles", () => ({
  isAdminRole: vi.fn(() => true),
}));

vi.mock("@/lib/agents/tenantScope", () => ({
  getTenantScopedPrismaClient: vi.fn(),
  toTenantErrorResponse: vi.fn(),
}));

type PrismaMock = {
  hiringManagerBrief: { findFirst: ReturnType<typeof vi.fn> };
  jobIntent: { findFirst: ReturnType<typeof vi.fn> };
};

type RequestContext = { params: { jobReqId: string } };

function buildRequest(jobReqId: string) {
  const url = new URL(`http://localhost/api/jobs/${jobReqId}/hm-brief`);
  const request = new Request(url, { method: "GET" });
  return new NextRequest(request);
}

describe("verify:mvp | hiring manager brief intent contract", () => {
  it("returns the latest brief and intent snapshot when present", async () => {
    const { getCurrentUser } = await import("@/lib/auth/user");
    const { getTenantScopedPrismaClient } = await import("@/lib/agents/tenantScope");

    const prismaMock: PrismaMock = {
      hiringManagerBrief: {
        findFirst: vi.fn().mockResolvedValue({
          id: "brief-1",
          jobReqId: "job-123",
          tenantId: "tenant-1",
          content: { summary: "Brief content" },
          status: "READY",
          createdAt: new Date("2024-01-01T00:00:00Z"),
          updatedAt: new Date("2024-01-02T00:00:00Z"),
          sentAt: null,
          sentTo: null,
        }),
      },
      jobIntent: {
        findFirst: vi.fn().mockResolvedValue({
          id: "intent-1",
          jobReqId: "job-123",
          tenantId: "tenant-1",
          intent: { summary: "Job intent" },
        }),
      },
    };

    vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1", role: "ADMIN" });
    vi.mocked(getTenantScopedPrismaClient).mockResolvedValue({ tenantId: "tenant-1", prisma: prismaMock });

    const response = await GET(buildRequest("job-123"), {
      params: { jobReqId: "job-123" } satisfies RequestContext["params"],
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.briefId).toBe("brief-1");
    expect(body.intentStatus).toBe("READY");
    expect(body.intentSnapshot).toEqual({ summary: "Job intent" });
  });

  it("surfaces an explicit missing intent status when the job intent is absent", async () => {
    const { getCurrentUser } = await import("@/lib/auth/user");
    const { getTenantScopedPrismaClient } = await import("@/lib/agents/tenantScope");

    const prismaMock: PrismaMock = {
      hiringManagerBrief: {
        findFirst: vi.fn().mockResolvedValue({
          id: "brief-2",
          jobReqId: "job-789",
          tenantId: "tenant-1",
          content: { summary: "Brief content" },
          status: "READY",
          createdAt: new Date("2024-02-01T00:00:00Z"),
          updatedAt: new Date("2024-02-02T00:00:00Z"),
          sentAt: null,
          sentTo: null,
        }),
      },
      jobIntent: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-2", role: "ADMIN" });
    vi.mocked(getTenantScopedPrismaClient).mockResolvedValue({ tenantId: "tenant-1", prisma: prismaMock });

    const response = await GET(buildRequest("job-789"), {
      params: { jobReqId: "job-789" } satisfies RequestContext["params"],
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.intentStatus).toBe("MISSING");
    expect(body.intentSnapshot).toBeNull();
  });
});
