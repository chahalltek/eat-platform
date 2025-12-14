/// <reference types="vitest/globals" />

import { NextRequest } from "next/server";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isAdminRole: vi.fn(),
  getTenantScopedPrismaClient: vi.fn(),
  toTenantErrorResponse: vi.fn(),
  prisma: {
    hiringManagerBrief: { findFirst: vi.fn() },
    jobIntent: { findFirst: vi.fn() },
    tenantUser: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/auth/user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/auth/roles", () => ({ isAdminRole: mocks.isAdminRole }));
vi.mock("@/lib/agents/tenantScope", () => ({
  getTenantScopedPrismaClient: mocks.getTenantScopedPrismaClient,
  toTenantErrorResponse: mocks.toTenantErrorResponse,
}));

describe("GET /api/jobs/[jobReqId]/hm-brief", () => {
  const baseContext = { params: { jobReqId: "job-123" } } as const;

  const briefRecord = {
    id: "brief-1",
    jobReqId: "job-123",
    content: { summary: "brief" },
    status: "READY",
    createdAt: new Date("2024-05-01T00:00:00.000Z"),
    updatedAt: new Date("2024-05-02T00:00:00.000Z"),
    sentAt: null,
    sentTo: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getCurrentUser.mockResolvedValue({ id: "user-1", role: "ADMIN" });
    mocks.isAdminRole.mockReturnValue(true);
    mocks.getTenantScopedPrismaClient.mockResolvedValue({ prisma: mocks.prisma, tenantId: "tenant-1" });
    mocks.toTenantErrorResponse.mockReturnValue(null);
    mocks.prisma.hiringManagerBrief.findFirst.mockResolvedValue(briefRecord);
  });

  it("returns a brief when job intent exists", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.prisma.jobIntent.findFirst.mockResolvedValue({ id: "intent-1" });

    const request = new NextRequest("http://localhost/api/jobs/job-123/hm-brief");
    const response = await GET(request, baseContext);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      briefId: "brief-1",
      jobId: "job-123",
      content: { summary: "brief" },
      status: "READY",
      createdAt: "2024-05-01T00:00:00.000Z",
      updatedAt: "2024-05-02T00:00:00.000Z",
      sentAt: null,
      sentTo: null,
    });
    expect(warnSpy).not.toHaveBeenCalled();
    expect(mocks.prisma.jobIntent.findFirst).toHaveBeenCalledWith({
      where: { jobReqId: "job-123", tenantId: "tenant-1" },
    });

    warnSpy.mockRestore();
  });

  it("returns 409 when job intent is missing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.prisma.jobIntent.findFirst.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/jobs/job-123/hm-brief");
    const response = await GET(request, baseContext);
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual({
      error: "JOB_INTENT_MISSING",
      message: "Job intent missing; run ingestion or intake before generating a brief.",
      jobReqId: "job-123",
    });
    expect(warnSpy).toHaveBeenCalledWith("Job intent missing for hiring manager brief", {
      jobReqId: "job-123",
      tenantId: "tenant-1",
    });

    warnSpy.mockRestore();
  });
});
