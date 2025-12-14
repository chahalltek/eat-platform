import { describe, expect, it, vi } from "vitest";

import { defaultTenantGuardrails } from "@/lib/guardrails/defaultTenantConfig";

import {
  buildConfidenceSummary,
  getConfidenceBand,
  runConfidenceAgent,
  type MatchResult,
  type ConfidenceRiskFlag,
} from "./confidenceEngine";

describe("getConfidenceBand", () => {
  it("uses default bands for boundary checks", () => {
    expect(getConfidenceBand(0.75, defaultTenantGuardrails)).toBe("HIGH");
    expect(getConfidenceBand(0.74, defaultTenantGuardrails)).toBe("MEDIUM");
    expect(getConfidenceBand(0.55, defaultTenantGuardrails)).toBe("MEDIUM");
    expect(getConfidenceBand(0.549, defaultTenantGuardrails)).toBe("LOW");
  });

  it("respects guardrail overrides for thresholds", () => {
    const guardrails = {
      ...defaultTenantGuardrails,
      safety: {
        ...defaultTenantGuardrails.safety,
        confidenceBands: { high: 0.9, medium: 0.6 },
      },
    } as const;

    expect(getConfidenceBand(0.95, guardrails)).toBe("HIGH");
    expect(getConfidenceBand(0.85, guardrails)).toBe("MEDIUM");
    expect(getConfidenceBand(0.55, guardrails)).toBe("LOW");
  });
});

describe("buildConfidenceSummary", () => {
  it("builds HIGH reasons using match signals", () => {
    const match: MatchResult = {
      candidateId: "alpha",
      score: 0.82,
      signals: { mustHaveCoverage: 0.92, experienceAlignment: 0.88, engagement: 0.7 },
    };

    const summary = buildConfidenceSummary(match, defaultTenantGuardrails);

    expect(summary.band).toBe("HIGH");
    expect(summary.reasons.join(" ")).toContain("Strong must-have coverage");
    expect(summary.reasons.join(" ")).toContain("Experience aligns with the role");
  });

  it("highlights weak areas for MEDIUM bands", () => {
    const match: MatchResult = {
      candidateId: "bravo",
      score: 0.7,
      signals: { mustHaveCoverage: 0.65, experienceAlignment: 0.45, missingMustHaves: ["Go"] },
    };

    const summary = buildConfidenceSummary(match, defaultTenantGuardrails);

    expect(summary.band).toBe("MEDIUM");
    expect(summary.reasons.join(" ")).toContain("experience alignment");
    expect(summary.reasons.join(" ")).toContain("Missing must-have skills");
  });
});

describe("runConfidenceAgent", () => {
  it("computes bands and reasons for each match", async () => {
    const mockLoadGuardrails = vi.fn().mockResolvedValue(defaultTenantGuardrails);
    const mockLoadMode = vi
      .fn()
      .mockResolvedValue({
        mode: "production",
        guardrailsPreset: "balanced",
        agentsEnabled: ["CONFIDENCE", "MATCH"],
      });

    const matchResults: MatchResult[] = [
      { candidateId: "cand-1", score: 0.8, signals: { mustHaveCoverage: 0.9 } },
      { candidateId: "cand-2", score: 0.52, signals: { missingMustHaves: ["Python"] } },
    ];

    const { results } = await runConfidenceAgent(
      { matchResults, job: { id: "job-1" }, tenantId: "tenant-1" },
      { loadGuardrails: mockLoadGuardrails, loadMode: mockLoadMode },
    );

    expect(results).toHaveLength(2);
    expect(results[0].confidenceBand).toBe("HIGH");
    expect(results[0].confidenceReasons.length).toBeGreaterThan(0);
    expect(results[0].confidenceScore).toBeGreaterThan(0);
    expect(results[0].recommendedAction).toBe("PUSH");
    expect(results[1].confidenceBand).toBe("LOW");
    expect(results[1].riskFlags.some((flag) => flag.type === "MISSING_DATA")).toBe(true);
  });

  it("omits textual reasons when confidence is disabled (fire drill)", async () => {
    const mockLoadGuardrails = vi.fn().mockResolvedValue(defaultTenantGuardrails);
    const mockLoadMode = vi
      .fn()
      .mockResolvedValue({ mode: "fire_drill", guardrailsPreset: "conservative", agentsEnabled: ["MATCH"] });

    const matchResults: MatchResult[] = [{ candidateId: "cand-1", score: 0.8 }];

    const { results } = await runConfidenceAgent(
      { matchResults, job: { id: "job-1" }, tenantId: "tenant-1" },
      { loadGuardrails: mockLoadGuardrails, loadMode: mockLoadMode },
    );

    expect(results[0].confidenceBand).toBe("HIGH");
    expect(results[0].confidenceReasons).toEqual([]);
    expect(results[0].riskFlags).toEqual([]);
  });

  it("identifies risk flags and recommended recruiter actions", async () => {
    const mockLoadGuardrails = vi.fn().mockResolvedValue(defaultTenantGuardrails);
    const mockLoadMode = vi
      .fn()
      .mockResolvedValue({ mode: "production", guardrailsPreset: "balanced", agentsEnabled: ["CONFIDENCE", "MATCH"] });

    const matchResults: MatchResult[] = [
      {
        candidateId: "cand-weak",
        score: 0.65,
        signals: {
          mustHaveCoverage: 0.8,
          experienceAlignment: 0.35,
          missingMustHaves: ["Go"],
          notes: ["Stale ATS sync; last updated 90d ago"],
        },
      },
    ];

    const { results } = await runConfidenceAgent(
      { matchResults, job: { id: "job-risk" }, tenantId: "tenant-risk" },
      { loadGuardrails: mockLoadGuardrails, loadMode: mockLoadMode },
    );

    const [result] = results;
    const riskTypes = result.riskFlags.map((flag: ConfidenceRiskFlag) => flag.type);
    expect(result.confidenceScore).toBeLessThan(65);
    expect(result.confidenceBand).toBe("LOW");
    expect(riskTypes).toEqual(expect.arrayContaining(["MISSING_DATA", "STALE_ATS_SYNC", "CONFLICTING_SIGNALS"]));
    expect(result.recommendedAction).toBe("ESCALATE");
  });
});
