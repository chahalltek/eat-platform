import { describe, expect, it } from "vitest";

import { type OrchestrationPolicy, DEFAULT_ORCHESTRATION_POLICIES, getTenantPolicies, parsePolicyConfig, selectApplicablePolicies } from "./policies";

describe("orchestration policies", () => {
  it("parses tenant config safely", () => {
    const raw = JSON.stringify({
      "tenant-a": [
        { when: "job_updated", steps: ["MATCH"] },
        { when: "candidate_ingested", steps: ["CONFIDENCE"], conditions: { minCandidates: 2 } },
      ],
      "*": [{ when: "manual", steps: ["MATCH"] }],
    } as Record<string, OrchestrationPolicy[]>);

    const config = parsePolicyConfig(raw);

    expect(config["tenant-a"]).toHaveLength(2);
    expect(config["*"][0]?.steps).toEqual(["MATCH"]);
  });

  it("falls back to defaults when config is missing or invalid", () => {
    expect(getTenantPolicies("tenant-1", undefined)).toEqual(DEFAULT_ORCHESTRATION_POLICIES);
    expect(getTenantPolicies("tenant-1", "not-json")).toEqual(DEFAULT_ORCHESTRATION_POLICIES);
  });

  it("filters policies by event and candidate counts", () => {
    const policies: OrchestrationPolicy[] = [
      { when: "candidate_ingested", steps: ["MATCH"], conditions: { minCandidates: 2 } },
      { when: "candidate_ingested", steps: ["CONFIDENCE"], conditions: { minCandidates: 1 } },
    ];

    const applicable = selectApplicablePolicies(policies, {
      event: "candidate_ingested",
      tenantMode: "pilot",
      candidateCount: 1,
    });

    expect(applicable).toHaveLength(1);
    expect(applicable[0]?.steps).toEqual(["CONFIDENCE"]);
  });

  it("skips non-essential automation during fire drill mode", () => {
    const policies: OrchestrationPolicy[] = [
      { when: "job_updated", steps: ["MATCH"] },
      { when: "job_updated", steps: ["CONFIDENCE"], conditions: { mode: "fire_drill" } },
      { when: "manual", steps: ["SHORTLIST"] },
    ];

    const applicable = selectApplicablePolicies(policies, {
      event: "job_updated",
      tenantMode: "fire_drill",
      candidateCount: 0,
    });

    expect(applicable).toHaveLength(1);
    expect(applicable[0]?.steps).toEqual(["CONFIDENCE"]);
  });
});
