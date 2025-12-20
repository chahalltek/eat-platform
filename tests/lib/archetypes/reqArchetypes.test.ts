import { describe, expect, it } from "vitest";

import { describeAssignment, getArchetypeDefinition, suggestReqArchetype } from "@/lib/archetypes/reqArchetypes";

describe("req archetypes", () => {
  it("suggests urgent backfill for fast backfill language", () => {
    const suggestion = suggestReqArchetype({
      intent: { priority: "urgent", responsibilitiesSummary: "Backfill a departed engineer" } as any,
      rawDescription: "We need an immediate backfill to cover a leave.",
    });

    expect(suggestion.id).toBe("urgent_backfill");
    expect(suggestion.defaultTradeoff).toMatch(/speed/);
  });

  it("returns definition data when describing an assignment", () => {
    const definition = getArchetypeDefinition("stretch_hire");
    const assignment = describeAssignment({ id: "stretch_hire", source: "manual" });

    expect(definition?.label).toBe("Stretch hire");
    expect(assignment?.explainCue).toContain("trajectory");
    expect(assignment?.defaultTradeoff).toMatch(/upside/i);
  });
});
