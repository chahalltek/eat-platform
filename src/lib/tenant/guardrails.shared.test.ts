import { describe, expect, it } from "vitest";

import {
  defaultTenantGuardrails,
  guardrailsSchema,
  mergeGuardrails,
} from "@/lib/tenant/guardrails.shared";

describe("guardrails.shared", () => {
  it("merges overrides while preserving defaults", () => {
    const merged = mergeGuardrails({
      preset: "balanced",
      scoring: { thresholds: { shortlistMaxCandidates: 5 } },
      llm: { model: "gpt-4o-mini" },
    });

    expect(merged.scoring.thresholds.shortlistMaxCandidates).toBe(5);
    expect(merged.scoring.weights.mustHaveSkills).toBe(defaultTenantGuardrails.scoring.weights.mustHaveSkills);
    expect(merged.llm.model).toBe("gpt-4o-mini");
    expect(merged.llm.allowedAgents).toEqual(defaultTenantGuardrails.llm.allowedAgents);
  });

  it("validates shortlist thresholds", () => {
    expect(() =>
      guardrailsSchema.parse({
        ...defaultTenantGuardrails,
        scoring: {
          ...defaultTenantGuardrails.scoring,
          thresholds: { ...defaultTenantGuardrails.scoring.thresholds, shortlistMinScore: 10, minMatchScore: 20 },
        },
      }),
    ).toThrowError(/Shortlist min score must be greater/);
  });

  it("falls back to defaults when overrides are missing", () => {
    const merged = mergeGuardrails(undefined);

    expect(merged).toEqual(defaultTenantGuardrails);
  });
});
