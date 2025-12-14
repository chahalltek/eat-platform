/// <reference types="vitest/globals" />

const mocks = vi.hoisted(() => ({
  ingestJobMock: vi.fn(),
  getCurrentTenantIdMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  prisma: {
    jobReq: { update: vi.fn(), findUnique: vi.fn() },
    jobIntent: { upsert: vi.fn() },
    matchResult: { findMany: vi.fn() },
    match: { findMany: vi.fn() },
  },
  isPrismaUnavailableErrorMock: vi.fn(() => false),
  isTableAvailableMock: vi.fn(() => true),
  recordMetricEventMock: vi.fn(),
  JobCandidateStatus: {
    POTENTIAL: "POTENTIAL",
    SHORTLISTED: "SHORTLISTED",
    SUBMITTED: "SUBMITTED",
    INTERVIEWING: "INTERVIEWING",
    HIRED: "HIRED",
  },
}));

vi.mock("@/lib/matching/matcher", () => ({ ingestJob: mocks.ingestJobMock }));
vi.mock("@/lib/tenant", () => ({ getCurrentTenantId: mocks.getCurrentTenantIdMock }));
vi.mock("@/lib/auth/user", () => ({ getCurrentUser: mocks.getCurrentUserMock }));
vi.mock("@/lib/orchestration/triggers", () => ({ onJobChanged: vi.fn() }));
vi.mock("@/server/db", () => ({
  prisma: mocks.prisma,
  isPrismaUnavailableError: mocks.isPrismaUnavailableErrorMock,
  isTableAvailable: mocks.isTableAvailableMock,
  JobCandidateStatus: mocks.JobCandidateStatus,
}));
vi.mock("@/lib/metrics/events", () => ({ recordMetricEvent: mocks.recordMetricEventMock }));

import { POST } from "./route";

describe("POST /api/jobs/ingest", () => {
  const originalEnv = {
    SECURITY_MODE: process.env.SECURITY_MODE,
    BULK_ACTIONS_ENABLED: process.env.BULK_ACTIONS_ENABLED,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentTenantIdMock.mockResolvedValue("tenant-123");
    mocks.getCurrentUserMock.mockResolvedValue({ id: "user-1", role: "ADMIN", tenantId: "tenant-123" });
    mocks.prisma.jobIntent.upsert.mockResolvedValue({ id: "intent-1", jobReqId: "job-1", intent: {} });
    mocks.prisma.jobReq.findUnique.mockResolvedValue({ id: "job-1", tenantId: "tenant-123", status: "OPEN" });
    mocks.prisma.matchResult.findMany.mockResolvedValue([]);
    mocks.prisma.match.findMany.mockResolvedValue([]);
    mocks.ingestJobMock.mockResolvedValue({
      id: "job-1",
      tenantId: "tenant-123",
      title: "Backend Engineer",
      skills: [
        { name: "Node.js", normalizedName: "node.js", required: true, weight: 2 },
        { name: "PostgreSQL", normalizedName: "postgresql", required: false, weight: 2 },
      ],
    });
    process.env.SECURITY_MODE = "internal";
    process.env.BULK_ACTIONS_ENABLED = "true";
  });

  afterEach(() => {
    process.env.SECURITY_MODE = originalEnv.SECURITY_MODE;

    if (originalEnv.BULK_ACTIONS_ENABLED === undefined) {
      delete process.env.BULK_ACTIONS_ENABLED;
    } else {
      process.env.BULK_ACTIONS_ENABLED = originalEnv.BULK_ACTIONS_ENABLED;
    }
  });

  it("validates input and ingests a job", async () => {
    const request = new Request("http://localhost/api/jobs/ingest", {
      method: "POST",
      body: JSON.stringify({
        title: "Backend Engineer",
        location: "Remote",
        skills: [
          { name: "Node.js", required: true },
          { name: "PostgreSQL", weight: 2 },
        ],
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(mocks.ingestJobMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Backend Engineer" }),
      expect.anything(),
    );
    expect(payload.skills[0].normalizedName).toBe("node.js");
    expect(mocks.recordMetricEventMock).toHaveBeenCalledWith({
      tenantId: "tenant-123",
      eventType: "JOB_CREATED",
      entityId: "job-1",
      meta: {
        skillsCount: 2,
        sourceTag: undefined,
        sourceType: "ingest",
      },
    });
  });

  it("rejects invalid payloads", async () => {
    const request = new Request("http://localhost/api/jobs/ingest", {
      method: "POST",
      body: JSON.stringify({ skills: [{ name: "Node.js" }] }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("title is required");
    expect(mocks.ingestJobMock).not.toHaveBeenCalled();
  });

  it("rejects bulk ingestion when disabled for security", async () => {
    process.env.SECURITY_MODE = "preview";
    delete process.env.BULK_ACTIONS_ENABLED;

    const request = new Request("http://localhost/api/jobs/ingest", {
      method: "POST",
      body: JSON.stringify({ title: "Backend Engineer" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("Bulk actions is disabled");
    expect(mocks.ingestJobMock).not.toHaveBeenCalled();
  });
});

