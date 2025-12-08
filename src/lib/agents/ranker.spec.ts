import { describe, expect, it } from "vitest";

import {
  RANKER_DEFAULT_WEIGHTS,
  rankCandidates,
  type RankerCandidate,
  type RankerWeights,
} from "@/lib/agents/ranker";

describe("TS-A4 Ranker", () => {
  const baseCandidates: RankerCandidate[] = [
    { id: "alpha", matchScore: 92, confidenceScore: 70, recencyDays: 14, roleAlignment: 80 },
    { id: "bravo", matchScore: 88, confidenceScore: 85, recencyDays: 3, roleAlignment: 75 },
    { id: "charlie", matchScore: 92, confidenceScore: 70, recencyDays: 5, roleAlignment: 80 },
    { id: "delta", matchScore: 65, confidenceScore: 55, recencyDays: 1, roleAlignment: 60 },
    { id: "echo", matchScore: 78, confidenceScore: 78, recencyDays: 12, roleAlignment: 78 },
    { id: "foxtrot", matchScore: 78, confidenceScore: 78, recencyDays: 0, roleAlignment: 78 },
  ];

  it("orders candidates using weighted scores with deterministic tie-breaking", () => {
    const ranked = rankCandidates(baseCandidates);

    expect(ranked.map((candidate) => candidate.id)).toEqual([
      "bravo", // strong confidence and very recent activity
      "charlie", // equal match to alpha but fresher activity
      "alpha", // same as charlie with older activity
      "foxtrot", // matches echo but more recent
      "echo",
      "delta",
    ]);

    expect(ranked[0].priorityScore).toBeGreaterThanOrEqual(ranked[1].priorityScore);
    expect(ranked[0].recencyDays).toBeLessThan(ranked[1].recencyDays);
    expect(ranked[2].priorityScore).toBeLessThan(ranked[1].priorityScore);
    expect(ranked[3].priorityScore).toBeGreaterThan(ranked[4].priorityScore);
  });

  it("responds to weight changes to emphasize different signals", () => {
    const recencyHeavyWeights: RankerWeights = {
      matchScore: 0.2,
      confidenceScore: 0.15,
      recency: 0.5,
      roleAlignment: 0.15,
    };

    const defaultOrder = rankCandidates(
      [
        { id: "steady-fit", matchScore: 95, confidenceScore: 70, recencyDays: 30, roleAlignment: 80 },
        { id: "fresh-fit", matchScore: 80, confidenceScore: 80, recencyDays: 0, roleAlignment: 80 },
      ],
      RANKER_DEFAULT_WEIGHTS,
    ).map((candidate) => candidate.id);

    const recencyFavoredOrder = rankCandidates(
      [
        { id: "steady-fit", matchScore: 95, confidenceScore: 70, recencyDays: 30, roleAlignment: 80 },
        { id: "fresh-fit", matchScore: 80, confidenceScore: 80, recencyDays: 0, roleAlignment: 80 },
      ],
      recencyHeavyWeights,
    ).map((candidate) => candidate.id);

    expect(defaultOrder[0]).toBe("steady-fit");
    expect(recencyFavoredOrder[0]).toBe("fresh-fit");
  });
});
