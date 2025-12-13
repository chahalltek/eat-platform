import { describe, expect, it } from "vitest";

import {
  attributeGuardrailsPerformance,
  buildLearningRecords,
  type DecisionStreamLink,
  type HiringOutcomeRecord,
  type MatchAttribution,
} from "@/lib/learning/guardrailsAttribution";

describe("guardrailsAttribution", () => {
  const outcomes: HiringOutcomeRecord[] = [
    { jobId: "job-1", candidateId: "cand-1", status: "interviewed", createdAt: new Date("2024-06-01T00:00:00Z") },
    { jobId: "job-1", candidateId: "cand-2", status: "hired", createdAt: new Date("2024-06-02T00:00:00Z") },
    { jobId: "job-1", candidateId: "cand-3", status: "rejected", createdAt: new Date("2024-06-03T00:00:00Z") },
    { jobId: "job-2", candidateId: "cand-4", status: "interviewed", createdAt: new Date("2024-06-04T00:00:00Z") },
  ];

  const decisions: DecisionStreamLink[] = [
    { jobId: "job-1", candidateId: "cand-1", decisionStreamId: "ds-1", action: "shortlisted" },
    { jobId: "job-1", candidateId: "cand-3", decisionStreamId: "ds-2", action: "shortlisted" },
  ];

  const matchResults: MatchAttribution[] = [
    {
      jobId: "job-1",
      candidateId: "cand-1",
      matchResultId: "match-1",
      decisionStreamId: "ds-1",
      guardrailsPreset: "balanced",
      guardrailsConfigHash: "hash-a",
      shortlistStrategy: "quality",
      systemMode: "production",
      roleFamily: "Engineering",
      createdAt: new Date("2024-06-01T01:00:00Z"),
    },
    {
      jobId: "job-1",
      candidateId: "cand-2",
      matchResultId: "match-2",
      decisionStreamId: "ds-1",
      guardrailsPreset: "balanced",
      guardrailsConfigHash: "hash-a",
      shortlistStrategy: "quality",
      systemMode: "production",
      roleFamily: "Engineering",
      createdAt: new Date("2024-06-02T01:00:00Z"),
    },
    {
      jobId: "job-1",
      candidateId: "cand-3",
      matchResultId: "match-3",
      decisionStreamId: "ds-2",
      guardrailsPreset: "conservative",
      guardrailsConfigHash: "hash-b",
      shortlistStrategy: "safety",
      systemMode: "fire_drill",
      roleFamily: "Engineering",
      createdAt: new Date("2024-06-03T01:00:00Z"),
    },
    {
      jobId: "job-2",
      candidateId: "cand-4",
      matchResultId: "match-4",
      decisionStreamId: "ds-3",
      guardrailsPreset: "balanced",
      guardrailsConfigHash: "hash-a",
      shortlistStrategy: "quality",
      systemMode: "production",
      roleFamily: "Engineering",
      createdAt: new Date("2024-06-04T01:00:00Z"),
    },
  ];

  it("groups learning records by guardrails preset and system mode", () => {
    const summary = attributeGuardrailsPerformance({ outcomes, matchResults, decisionItems: decisions });

    expect(summary).toHaveLength(2);

    const balanced = summary.find((entry) => entry.preset === "balanced");
    const conservative = summary.find((entry) => entry.preset === "conservative");

    expect(balanced).toMatchObject({
      preset: "balanced",
      systemMode: "production",
      shortlistStrategy: "quality",
      configHash: "hash-a",
      roleFamily: "Engineering",
      sampleSize: 3,
    });
    expect(balanced?.interviewRate).toBeCloseTo(0.67, 2);
    expect(balanced?.hireRate).toBeCloseTo(0.33, 2);
    expect(balanced?.falsePositiveRate).toBe(0);

    expect(conservative).toMatchObject({
      preset: "conservative",
      systemMode: "fire_drill",
      shortlistStrategy: "safety",
      configHash: "hash-b",
      sampleSize: 1,
      falsePositiveRate: 1,
    });
  });

  it("prefers the latest match metadata per candidate without mutating inputs", () => {
    const duplicateMetadata: MatchAttribution[] = [
      {
        jobId: "job-1",
        candidateId: "cand-1",
        guardrailsPreset: "outdated",
        guardrailsConfigHash: "old-hash",
        shortlistStrategy: "old",
        systemMode: "pilot",
        createdAt: new Date("2024-05-31T12:00:00Z"),
      },
      ...matchResults,
    ];

    const clonedMatches = typeof structuredClone === "function"
      ? structuredClone(duplicateMetadata)
      : JSON.parse(JSON.stringify(duplicateMetadata));
    const merged = buildLearningRecords({ outcomes, matchResults: duplicateMetadata, decisionItems: decisions });

    const mergedRecord = merged.find((record) => record.candidateId === "cand-1");
    expect(mergedRecord?.guardrailsPreset).toBe("balanced");
    expect(mergedRecord?.guardrailsConfigHash).toBe("hash-a");
    expect(mergedRecord?.shortlistStrategy).toBe("quality");

    expect(duplicateMetadata).toEqual(clonedMatches);
  });

  it("handles missing guardrail metadata deterministically", () => {
    const records = attributeGuardrailsPerformance({ outcomes: outcomes.slice(0, 1) });

    expect(records).toEqual([
      {
        preset: "unknown",
        systemMode: "unknown",
        shortlistStrategy: "unknown",
        configHash: "unknown",
        roleFamily: "unspecified",
        interviewRate: 1,
        hireRate: 0,
        falsePositiveRate: 0,
        sampleSize: 1,
        coverage: { interviewed: 1, hired: 0, rejected: 0 },
      },
    ]);
  });
});
