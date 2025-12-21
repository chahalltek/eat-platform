import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDecisionArtifact,
  listDecisionArtifacts,
  publishDecisionArtifact,
} from "@/server/decision/decisionArtifacts";

const { DecisionArtifactStatus, DecisionArtifactType, mockCreate, mockUpdate, mockFindMany, mockWithTenantContext } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockFindMany: vi.fn(),
  mockWithTenantContext: vi.fn(async (_tenantId: string, callback: () => Promise<unknown>) => callback()),
  DecisionArtifactStatus: {
    DRAFT: "DRAFT",
    PUBLISHED: "PUBLISHED",
  } as const,
  DecisionArtifactType: {
    RECOMMENDATION: "RECOMMENDATION",
    SHORTLIST: "SHORTLIST",
    INTAKE_SUMMARY: "INTAKE_SUMMARY",
  } as const,
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    decisionArtifact: {
      create: mockCreate,
      update: mockUpdate,
      findMany: mockFindMany,
    },
  },
  DecisionArtifactStatus,
  DecisionArtifactType,
  Prisma: {},
}));

vi.mock("@/lib/tenant", () => ({
  withTenantContext: mockWithTenantContext,
}));

describe("decision artifacts", () => {
  beforeEach(() => {
    vi.useRealTimers();
    mockCreate.mockReset();
    mockUpdate.mockReset();
    mockFindMany.mockReset();
    mockWithTenantContext.mockClear();
  });

  it("creates draft artifacts with normalized payload and candidate ids", async () => {
    mockCreate.mockResolvedValue({ id: "artifact-1" });

    const result = await createDecisionArtifact({
      tenantId: "tenant-1",
      jobId: "job-1",
      candidateIds: ["cand-1", " cand-2 ", ""],
      type: DecisionArtifactType.RECOMMENDATION,
      payload: { summary: "Reasoning" },
      createdByUserId: "user-1",
    });

    expect(result).toEqual({ id: "artifact-1" });
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        jobId: "job-1",
        candidateIds: ["cand-1", "cand-2"],
        type: DecisionArtifactType.RECOMMENDATION,
        payload: { summary: "Reasoning" },
        createdByUserId: "user-1",
        status: DecisionArtifactStatus.DRAFT,
        publishedAt: null,
      },
    });
  });

  it("publishes artifacts and allows payload updates", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));

    await publishDecisionArtifact({
      artifactId: "artifact-2",
      tenantId: "tenant-1",
      payload: { rationale: "Agent decision" },
    });

    expect(mockWithTenantContext).toHaveBeenCalledWith("tenant-1", expect.any(Function));
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "artifact-2" },
      data: expect.objectContaining({
        status: DecisionArtifactStatus.PUBLISHED,
        payload: { rationale: "Agent decision" },
        publishedAt: new Date("2025-01-01T00:00:00.000Z"),
      }),
    });
  });

  it("lists artifacts scoped by job and candidate filters", async () => {
    const artifacts = [
      { id: "artifact-3", jobId: "job-2", candidateIds: ["cand-3"], status: DecisionArtifactStatus.PUBLISHED },
    ];
    mockFindMany.mockResolvedValue(artifacts);

    const result = await listDecisionArtifacts({
      tenantId: "tenant-1",
      jobId: "job-2",
      candidateId: "cand-3",
      types: [DecisionArtifactType.RECOMMENDATION],
      status: [DecisionArtifactStatus.PUBLISHED],
      limit: 10,
    });

    expect(result).toBe(artifacts);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        jobId: "job-2",
        candidateIds: { has: "cand-3" },
        type: { in: [DecisionArtifactType.RECOMMENDATION] },
        status: { in: [DecisionArtifactStatus.PUBLISHED] },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
  });
});
