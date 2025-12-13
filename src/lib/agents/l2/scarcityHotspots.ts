import { getMarketSignals } from "@/lib/market/marketSignals";

import type { L2Input, L2Result } from "./types";

function calculateScore({
  scarcityIndex,
  demand,
  p90Days,
}: {
  scarcityIndex: number;
  demand: number;
  p90Days: number | null;
}) {
  const scarcityWeight = scarcityIndex * 0.7;
  const demandWeight = Math.log1p(Math.max(0, demand)) * 6;
  const velocityDrag = p90Days ? Math.min(25, p90Days / 3) : 10;

  return Math.round((scarcityWeight + demandWeight + velocityDrag) * 100) / 100;
}

export async function runScarcityHotspots(input: L2Input): Promise<L2Result> {
  const signals = await getMarketSignals({
    roleFamily: input.scope?.roleFamily,
    region: input.scope?.region,
  });

  const items = signals.skillScarcity
    .map((entry) => {
      const timeToFill = signals.timeToFillBenchmarks.find(
        (benchmark) => benchmark.roleFamily === entry.roleFamily && (!input.scope?.region || benchmark.region === input.scope.region),
      );
      const score = calculateScore({
        scarcityIndex: entry.scarcityIndex,
        demand: entry.demand,
        p90Days: timeToFill?.p90Days ?? null,
      });
      const confidenceSamples = signals.confidenceByRegion.reduce((sum, region) => sum + region.total, 0);
      const rationale = [
        `Scarcity index ${entry.scarcityIndex} driven by demand ${entry.demand} vs supply ${entry.supply}.`,
        timeToFill
          ? `P90 time-to-fill at ${timeToFill.p90Days}d indicates sustained pressure.`
          : "Limited benchmark samples; using aggregate scarcity signal.",
        `Confidence mix tracked across ${confidenceSamples} recent observations.`,
      ];

      return {
        title: `${entry.roleFamily} (${entry.demand} open roles)`,
        score,
        rationale,
        references: [
          { type: "market_signal", label: signals.label },
          { type: "benchmark", label: `${entry.roleFamily} ${signals.region ?? "all regions"}` },
        ],
      } satisfies L2Result["items"][number];
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.title.localeCompare(b.title);
    });

  return {
    question: "SCARCITY_HOTSPOTS",
    generatedAt: new Date().toISOString(),
    items,
  } satisfies L2Result;
}
