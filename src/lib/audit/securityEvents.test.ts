import { describe, expect, it, beforeEach, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  securityEventLog: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock("@/server/db/prisma", () => ({ prisma }));
import { getCurrentTenantId } from "@/lib/tenant";
import { getCurrentUserId } from "@/lib/auth/user";

import {
  SECURITY_EVENT_TYPES,
  listSecurityEvents,
  logDataExportRequested,
  logLoginFailure,
  logLoginSuccess,
  logPlanChanged,
  logRetentionJobRun,
  logRoleChanged,
} from "./securityEvents";

type PrismaCreateArgs = Parameters<typeof prisma.securityEventLog.create>[0];

type SecurityEvent = {
  id: string;
  tenantId: string;
  userId: string | null;
  eventType: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
};

vi.mock("@/lib/tenant", () => ({
  getCurrentTenantId: vi.fn(),
}));

vi.mock("@/lib/auth/user", () => ({
  getCurrentUserId: vi.fn(),
}));

function buildEvent(overrides: Partial<SecurityEvent> = {}): SecurityEvent {
  return {
    id: "event-1",
    tenantId: "tenant-ctx",
    userId: "user-ctx",
    eventType: SECURITY_EVENT_TYPES.LOGIN_SUCCESS,
    metadata: { ip: "127.0.0.1" },
    createdAt: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  };
}

function mockCreateToReturnPayload() {
  vi.mocked(prisma.securityEventLog.create).mockImplementation(async (args: PrismaCreateArgs) =>
    buildEvent({ ...args.data, metadata: (args.data as any).metadata ?? {} }),
  );
}

describe("security event audit pipeline", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentTenantId).mockResolvedValue("tenant-ctx");
    vi.mocked(getCurrentUserId).mockResolvedValue("user-ctx");
    mockCreateToReturnPayload();
  });

  it("logs login successes", async () => {
    const event = await logLoginSuccess({ ip: "10.0.0.1", userAgent: "vitest" });

    expect(prisma.securityEventLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: SECURITY_EVENT_TYPES.LOGIN_SUCCESS,
        tenantId: "tenant-ctx",
        userId: "user-ctx",
        metadata: { ip: "10.0.0.1", userAgent: "vitest" },
      }),
    });
    expect(event.metadata).toEqual({ ip: "10.0.0.1", userAgent: "vitest" });
  });

  it("captures login failures with reasons", async () => {
    const event = await logLoginFailure({ reason: "invalid-password", ip: "10.0.0.2" });

    expect(prisma.securityEventLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: SECURITY_EVENT_TYPES.LOGIN_FAILURE,
        metadata: { reason: "invalid-password", ip: "10.0.0.2", userAgent: null },
      }),
    });
    expect(event.eventType).toBe(SECURITY_EVENT_TYPES.LOGIN_FAILURE);
  });

  it("records role changes for targeted users", async () => {
    await logRoleChanged({ targetUserId: "user-2", previousRole: "recruiter", newRole: "admin" });

    expect(prisma.securityEventLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: SECURITY_EVENT_TYPES.ROLE_CHANGED,
        metadata: { targetUserId: "user-2", previousRole: "recruiter", newRole: "admin" },
      }),
    });
  });

  it("records plan migrations", async () => {
    await logPlanChanged({ tenantId: "tenant-explicit", userId: "actor-1", previousPlan: null, newPlan: "enterprise" });

    expect(prisma.securityEventLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-explicit",
        userId: "actor-1",
        eventType: SECURITY_EVENT_TYPES.PLAN_CHANGED,
        metadata: { previousPlan: null, newPlan: "enterprise" },
      }),
    });
    expect(getCurrentTenantId).not.toHaveBeenCalled();
  });

  it("logs export requests with sanitized metadata", async () => {
    await logDataExportRequested({ exportType: "candidates", destination: "s3://bucket", format: undefined });

    expect(prisma.securityEventLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: SECURITY_EVENT_TYPES.DATA_EXPORT_REQUESTED,
        metadata: { exportType: "candidates", destination: "s3://bucket" },
      }),
    });
  });

  it("tracks retention and deletion job executions", async () => {
    await logRetentionJobRun({ jobName: "retention-cleanup", deletedRecords: 5, retainedRecords: 95 });

    expect(prisma.securityEventLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: SECURITY_EVENT_TYPES.RETENTION_JOB_RUN,
        metadata: { jobName: "retention-cleanup", deletedRecords: 5, retainedRecords: 95, details: undefined },
      }),
    });
  });

  it("lists normalized events for the UI", async () => {
    const rawEvents = [
      buildEvent({ id: "event-2", metadata: { destination: "s3" }, eventType: SECURITY_EVENT_TYPES.DATA_EXPORT_REQUESTED }),
      buildEvent({ id: "event-3", metadata: null }),
    ];

    vi.mocked(prisma.securityEventLog.findMany).mockResolvedValue(rawEvents as never);

    const events = await listSecurityEvents(10);

    expect(prisma.securityEventLog.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      take: 10,
      where: { tenantId: "tenant-ctx" },
    });
    expect(events).toHaveLength(2);
    expect(events[0].metadata).toEqual({ destination: "s3" });
    expect(events[1].metadata).toEqual({});
  });
});
