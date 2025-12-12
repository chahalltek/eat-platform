import { describe, expect, it } from "vitest";

import type { GuardrailFeedbackRecord } from "./performance";
import { summarizeGuardrailPerformance } from "./performance";

function buildRecord(overrides: Partial<GuardrailFeedbackRecord>): GuardrailFeedbackRecord {
  return {
    outcome: "SCREENED",
    guardrailsPreset: "balanced",
    guardrailsConfig: {},
    matchSignals: {},
    jobReqId: "job-1",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    jobReqTitle: "Data Engineer",
    ...overrides,
  };
}

describe("summarizeGuardrailPerformance", () => {
  it("builds preset deltas, job attribution, and role insights", () => {
    const records: GuardrailFeedbackRecord[] = [
      buildRecord({
        outcome: "INTERVIEWED",
        guardrailsPreset: "balanced",
        matchSignals: { shortlisted: true },
        guardrailsConfig: { scoring: { thresholds: { minMatchScore: 0.6, shortlistMaxCandidates: 5 } } },
      }),
      buildRecord({
        outcome: "HIRED",
        guardrailsPreset: "balanced",
        matchSignals: { shortlisted: true },
        createdAt: new Date("2024-01-02T00:00:00Z"),
      }),
      buildRecord({
        outcome: "REJECTED",
        guardrailsPreset: "conservative",
        matchSignals: { shortlisted: true },
        createdAt: new Date("2024-01-03T00:00:00Z"),
      }),
      buildRecord({
        outcome: "INTERVIEWED",
        guardrailsPreset: "conservative",
        matchSignals: { shortlisted: true },
        createdAt: new Date("2024-01-04T00:00:00Z"),
      }),
      buildRecord({
        outcome: "HIRED",
        guardrailsPreset: "aggressive",
        matchSignals: { shortlisted: true },
        createdAt: new Date("2024-01-05T00:00:00Z"),
        jobReqId: "job-2",
        jobReqTitle: "Data Scientist",
      }),
    ];

    const report = summarizeGuardrailPerformance(records);

    const balancedStats = report.byPreset.find((entry) => entry.preset === "balanced");
    expect(balancedStats).toMatchObject({
      totals: 2,
      interviews: 1,
      hires: 1,
      interviewRate: 50,
      hireRate: 50,
      falsePositiveRate: 0,
    });

    const conservativeStats = report.byPreset.find((entry) => entry.preset === "conservative");
    expect(conservativeStats).toMatchObject({
      totals: 2,
      hires: 0,
      falsePositives: 1,
    });

    const deltas = report.deltas.filter((delta) => delta.metric === "hireRate" && delta.preset === "conservative");
    expect(deltas[0]?.delta).toBe(-50);

    expect(report.jobAttribution).toContainEqual({
      jobReqId: "job-1",
      title: "Data Engineer",
      guardrailsPreset: "conservative",
      thresholds: { minMatchScore: 0.65, shortlistMinScore: 0.75, shortlistMaxCandidates: 3 },
      updatedAt: new Date("2024-01-04T00:00:00.000Z").toISOString(),
    });

    const insight = report.roleInsights.find((entry) => entry.role === "Data Engineer");
    expect(insight?.bestPreset).toBe("balanced");
    expect(insight?.comparedTo).toBe("conservative");
    expect(insight?.statement).toContain("outperformed");
  });
});
