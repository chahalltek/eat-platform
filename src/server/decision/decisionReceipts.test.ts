<<<<<<< ours
import { describe, expect, beforeEach, it, vi } from "vitest";

import type { IdentityUser } from "@/lib/auth/types";
import { createDecisionReceipt, listDecisionReceipts } from "./decisionReceipts";

type MetricEventInput = {
  id: string;
  tenantId: string;
  eventType: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
  createdAt: Date;
};

const mocks = vi.hoisted(() => {
  const metricEvents: MetricEventInput[] = [];

  const mockCreate = vi.fn(async ({ data }: { data: Omit<MetricEventInput, "id"> }) => {
    const created: MetricEventInput = {
      id: `evt-${metricEvents.length + 1}`,
      ...data,
      createdAt: data.createdAt ?? new Date(),
    };
    metricEvents.push(created);
    return created;
  });

  const mockFindMany = vi.fn(
    async (params: { where: Record<string, unknown>; orderBy?: { createdAt: "asc" | "desc" }; take?: number }) => {
      const { where, orderBy, take } = params;
      const tenantId = where.tenantId as string;
      const eventType = where.eventType as string;
      const metaFilter = where.meta as Record<string, unknown>;
      const andFilters = (where.AND as Record<string, unknown>[] | undefined) ?? [];

      const filtered = metricEvents.filter((entry) => {
        if (entry.tenantId !== tenantId || entry.eventType !== eventType) return false;

        const jobPath = (metaFilter.path as string[] | undefined) ?? [];
        if (jobPath[0] === "jobId" && (metaFilter.equals as string | undefined)) {
          const jobId = (entry.meta?.jobId as string | undefined) ?? entry.entityId;
          if (jobId !== metaFilter.equals) return false;
        }

        return andFilters.every((filter) => {
          const path = (filter.meta as { path?: string[]; equals?: string }).path ?? [];
          const equals = (filter.meta as { equals?: string }).equals;
          if (!path.length || equals === undefined) return true;
          const value = entry.meta?.[path[0] ?? ""];
          return value === equals;
        });
      });

      const ordered = [...filtered].sort((a, b) =>
        (orderBy?.createdAt ?? "desc") === "desc"
          ? b.createdAt.getTime() - a.createdAt.getTime()
          : a.createdAt.getTime() - b.createdAt.getTime(),
      );

      return typeof take === "number" ? ordered.slice(0, take) : ordered;
    },
  );

  return { metricEvents, mockCreate, mockFindMany };
});

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    metricEvent: {
      create: mocks.mockCreate,
      findMany: mocks.mockFindMany,
    },
  },
}));

vi.mock("@/lib/metrics/events", () => ({
  recordMetricEvent: vi.fn(),
}));

vi.mock("@/lib/audit/trail", () => ({
  recordAuditEvent: vi.fn(async () => ({
    id: `audit-${mocks.metricEvents.length + 1}`,
  })),
}));

describe("decision receipts governance and audit trail", () => {
  const user: IdentityUser = {
    id: "user-1",
    tenantId: "tenant-1",
    email: "recruiter@example.com",
    displayName: "Recruiter",
  };

  beforeEach(() => {
    mocks.metricEvents.splice(0, mocks.metricEvents.length);
    mocks.mockCreate.mockClear();
    mocks.mockFindMany.mockClear();
  });

  it("tracks chain integrity, overrides, and missing signals", async () => {
    await createDecisionReceipt({
      tenantId: "tenant-1",
      payload: {
        jobId: "job-1",
        candidateId: "cand-1",
        candidateName: "Candidate One",
        decisionType: "RECOMMEND",
        drivers: [],
        risks: [],
        confidenceScore: undefined,
        summary: undefined,
        bullhornTarget: "note",
        shortlistStrategy: "quality",
        recommendation: { alignment: "override", recommendedOutcome: "shortlist" },
      },
      user,
    });

    await createDecisionReceipt({
      tenantId: "tenant-1",
      payload: {
        jobId: "job-1",
        candidateId: "cand-1",
        candidateName: "Candidate One",
        decisionType: "SUBMIT",
        drivers: ["Skill depth"],
        risks: [],
        confidenceScore: 9,
        summary: "Submission with limited risks captured.",
        bullhornTarget: "note",
        shortlistStrategy: "quality",
        recommendation: { alignment: "disagree", recommendedOutcome: "pass", rationale: "Client feedback" },
      },
      user,
    });

    const receipts = await listDecisionReceipts({ tenantId: "tenant-1", jobId: "job-1", candidateId: "cand-1" });

    expect(receipts).toHaveLength(2);
    const [latest, first] = receipts;

    expect(latest.audit.chainPosition).toBe(2);
    expect(latest.audit.chainValid).toBe(true);
    expect(latest.audit.previousHash).toBeTruthy();

    expect(latest.governance.overrideCount).toBe(2);
    expect(latest.governance.repeatedOverrides).toBe(true);
    expect(latest.governance.overconfidence).toBe(true);
    expect(latest.governance.missingSignals).toContain("risks");

    expect(first.governance.missingSignals).toEqual(expect.arrayContaining(["drivers", "risks", "confidence"]));
=======
import { describe, expect, it } from "vitest";

import { CONFIDENCE_FRAMES, frameConfidence, standardizeRisks, standardizeTradeoff } from "./decisionReceipts";

describe("decision vocabulary standardization", () => {
  it("maps tradeoff hints to standardized labels", () => {
    const fastMatch = standardizeTradeoff("Pushed speed to keep req momentum high");
    expect(fastMatch).toMatchObject({
      key: "speed_over_precision",
      label: "Speed over precision to keep requisition momentum.",
    });

    const strictMatch = standardizeTradeoff("Used strict precision to protect quality");
    expect(strictMatch).toMatchObject({
      key: "precision_over_coverage",
      label: "Precision over coverage to protect quality.",
    });

    const fallback = standardizeTradeoff("Custom reasoning not covered");
    expect(fallback).toEqual({ key: "custom", label: "Custom tradeoff captured" });
  });

  it("standardizes risks while preserving free-text allowance", () => {
    const { labels, keys } = standardizeRisks([
      "Missing must-have coverage for skill",
      "Low confidence band noted",
      "Missing must-have coverage for skill",
      "Time zone mismatch could be an issue",
    ]);

    expect(keys).toEqual(["skill_gap", "data_quality_risk", "location_mismatch"]);
    expect(labels).toEqual([
      "Skill or coverage gap",
      "Data quality or confidence risk",
      "Location or availability mismatch",
    ]);
  });
});

describe("confidence framing", () => {
  it("returns band values aligned to the 10 point scale", () => {
    expect(frameConfidence(9)).toBe("HIGH");
    expect(frameConfidence(7)).toBe("MEDIUM");
    expect(frameConfidence(1)).toBe("LOW");
    expect(frameConfidence(null)).toBeNull();
  });

  it("exposes human readable frames", () => {
    expect(CONFIDENCE_FRAMES.HIGH).toContain("High confidence framing");
    expect(CONFIDENCE_FRAMES.LOW).toContain("Low confidence");
>>>>>>> theirs
  });
});
