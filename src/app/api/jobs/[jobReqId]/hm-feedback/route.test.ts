/// <reference types="vitest/globals" />

const prismaEnums = vi.hoisted(() => ({
  HiringManagerFeedbackStatus: {
    SUBMITTED: "SUBMITTED",
    PROCESSED: "PROCESSED",
  } as const,
  HiringManagerFeedbackType: {
    REQUIREMENT_CHANGED: "REQUIREMENT_CHANGED",
    CANDIDATE_REJECTED: "CANDIDATE_REJECTED",
    CANDIDATE_UPDATED: "CANDIDATE_UPDATED",
    THRESHOLD_ADJUSTED: "THRESHOLD_ADJUSTED",
  } as const,
}));

vi.mock("@prisma/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@prisma/client")>();

  return {
    ...actual,
    ...prismaEnums,
  };
});

import { HiringManagerFeedbackStatus, HiringManagerFeedbackType } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  getTenantScopedPrismaClientMock: vi.fn(),
  toTenantErrorResponseMock: vi.fn(),
  onJobChangedMock: vi.fn(),
  prisma: {
    tenantUser: { findUnique: vi.fn() },
    jobReq: { findFirst: vi.fn() },
    jobIntent: { findFirst: vi.fn(), upsert: vi.fn() },
    hiringManagerFeedback: { create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/auth/user", () => ({ getCurrentUser: mocks.getCurrentUserMock }));
vi.mock("@/lib/agents/tenantScope", () => ({
  getTenantScopedPrismaClient: mocks.getTenantScopedPrismaClientMock,
  toTenantErrorResponse: mocks.toTenantErrorResponseMock,
}));
vi.mock("@/lib/orchestration/triggers", () => ({ onJobChanged: mocks.onJobChangedMock }));

import { POST } from "./route";

describe("POST /api/jobs/[jobReqId]/hm-feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUserMock.mockResolvedValue({ id: "user-1", role: "ADMIN" });
    mocks.toTenantErrorResponseMock.mockReturnValue(null);
    mocks.getTenantScopedPrismaClientMock.mockResolvedValue({
      prisma: mocks.prisma,
      tenantId: "tenant-123",
      runWithTenantContext: async (cb: () => Promise<any>) => cb(),
    });
    mocks.prisma.tenantUser.findUnique.mockResolvedValue({ id: "membership-1" });
    mocks.prisma.jobReq.findFirst.mockResolvedValue({ id: "job-1", tenantId: "tenant-123" });
    mocks.prisma.jobIntent.findFirst.mockResolvedValue({
      id: "intent-1",
      jobReqId: "job-1",
      tenantId: "tenant-123",
      intent: { summary: "Existing", requirements: [] },
    });
    mocks.prisma.hiringManagerFeedback.create.mockResolvedValue({
      id: "feedback-1",
      status: HiringManagerFeedbackStatus.SUBMITTED,
      jobReqId: "job-1",
      tenantId: "tenant-123",
      payload: {},
    });
    mocks.prisma.jobIntent.upsert.mockResolvedValue({ id: "intent-1" });
  });

  it("stores feedback and updates job intent payload", async () => {
    const request = new Request("http://localhost/api/jobs/job-1/hm-feedback", {
      method: "POST",
      body: JSON.stringify({
        jobIntentId: "intent-1",
        feedbackType: HiringManagerFeedbackType.REQUIREMENT_CHANGED,
        payload: {
          requirements: [
            {
              id: "skill-node",
              type: "skill",
              label: "Node.js",
              normalizedLabel: "node.js",
              weight: 2,
              confidence: 0.9,
              required: true,
            },
          ],
          confidenceLevels: { requirements: 0.8 },
        },
      }),
    });

    const response = await POST(request as any, { params: { jobReqId: "job-1" } });
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.status).toBe(HiringManagerFeedbackStatus.PROCESSED);
    expect(mocks.prisma.hiringManagerFeedback.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ feedbackType: HiringManagerFeedbackType.REQUIREMENT_CHANGED }),
      }),
    );
    expect(mocks.prisma.jobIntent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { jobReqId: "job-1" },
        update: expect.objectContaining({ intent: expect.anything() }),
      }),
    );
    expect(mocks.prisma.hiringManagerFeedback.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: HiringManagerFeedbackStatus.PROCESSED }),
      }),
    );
    expect(mocks.onJobChangedMock).toHaveBeenCalledWith({ tenantId: "tenant-123", jobId: "job-1" });
  });

  it("rejects invalid payloads", async () => {
    const request = new Request("http://localhost/api/jobs/job-1/hm-feedback", {
      method: "POST",
      body: JSON.stringify({ candidateId: "candidate-1" }),
    });

    const response = await POST(request as any, { params: { jobReqId: "job-1" } });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid feedback payload");
    expect(mocks.prisma.hiringManagerFeedback.create).not.toHaveBeenCalled();
  });

  it("returns 404 when job is missing", async () => {
    mocks.prisma.jobReq.findFirst.mockResolvedValue(null);

    const request = new Request("http://localhost/api/jobs/job-2/hm-feedback", {
      method: "POST",
      body: JSON.stringify({ feedbackType: HiringManagerFeedbackType.CANDIDATE_REJECTED }),
    });

    const response = await POST(request as any, { params: { jobReqId: "job-2" } });

    expect(response.status).toBe(404);
    expect(mocks.prisma.hiringManagerFeedback.create).not.toHaveBeenCalled();
  });
});
