import type { DecisionReceipt } from "@/server/db/prisma";

import { describe, expect, it } from "vitest";

import { buildAggregates } from "./aggregator";

const now = new Date("2024-01-15T00:00:00Z");
const windowStart = new Date("2024-10-01T00:00:00Z");
const windowEnd = new Date("2024-12-31T23:59:59Z");

function buildReceipt(overrides: Partial<DecisionReceipt>): DecisionReceipt {
  return {
    id: overrides.id ?? `receipt-${Math.random().toString(16).slice(2)}`,
    tenantId: "tenant-1",
    firmId: "firm-1",
    clientId: "client-1",
    roleType: "data-engineer",
    agent: "MATCH",
    decisionType: "submit",
    signals: {},
    humanOverride: null,
    outcome: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as DecisionReceipt;
}

describe("buildAggregates", () => {
  it("summarizes decisions and overrides per dimension", () => {
    const receipts: DecisionReceipt[] = [
      buildReceipt({
        id: "r1",
        decisionType: "submit",
        signals: { confidenceBand: "high" },
        outcome: { hired: true, tenureDays: 120, performanceRating: 4.2 },
      }),
      buildReceipt({
        id: "r2",
        decisionType: "override",
        humanOverride: { reason: "HM preference" },
        signals: { confidenceBand: "medium" },
        outcome: { hired: true, tenureDays: 200, performanceRating: 4.8 },
      }),
      buildReceipt({
        id: "r3",
        decisionType: "reject",
        signals: { confidenceBand: "low" },
        outcome: { hired: false },
      }),
      buildReceipt({
        id: "r4",
        firmId: "firm-2",
        clientId: "client-2",
        roleType: "ml-engineer",
        decisionType: "submit",
        signals: { confidenceBand: "high" },
        outcome: { hired: false },
      }),
    ];

    const aggregates = buildAggregates({
      receipts,
      tenantId: "tenant-1",
      windowStart,
      windowEnd,
    });

    const firm1Hire = aggregates.find(
      (aggregate) => aggregate.dimension === "firm" && aggregate.dimensionValue === "firm-1" && aggregate.metric === "hire_rate",
    );
    expect(firm1Hire?.value).toMatchObject({ hires: 2, decisions: 2 });
    expect((firm1Hire?.value as any).rate).toBeCloseTo(1);

    const firm1Override = aggregates.find(
      (aggregate) => aggregate.dimension === "firm" && aggregate.dimensionValue === "firm-1" && aggregate.metric === "override_rate",
    );
    expect(firm1Override?.value).toMatchObject({ overrides: 1, total: 3 });
    expect((firm1Override?.value as any).rate).toBeCloseTo(1 / 3);

    const firm1Confidence = aggregates.find(
      (aggregate) =>
        aggregate.dimension === "firm" && aggregate.dimensionValue === "firm-1" && aggregate.metric === "confidence_band_success",
    );
    expect((firm1Confidence?.value as any).bands.high.total).toBe(1);
    expect((firm1Confidence?.value as any).bands.medium.hires).toBe(1);

    const roleOverrideLift = aggregates.find(
      (aggregate) =>
        aggregate.dimension === "role_type" &&
        aggregate.dimensionValue === "data-engineer" &&
        aggregate.metric === "override_success_delta",
    );
    expect((roleOverrideLift?.value as any).overrideHireRate).toBeCloseTo(1);
    expect((roleOverrideLift?.value as any).baselineHireRate).toBeCloseTo(2 / 3);
  });
});
