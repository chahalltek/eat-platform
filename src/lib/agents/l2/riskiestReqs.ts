import { intelligenceCache, intelligenceCacheKeys, INTELLIGENCE_CACHE_TTLS } from "@/lib/cache/intelligenceCache";
import { getTimeToFillRisksForTenant, type TimeToFillRisk } from "@/lib/forecast/timeToFillRisk";

import type { L2Input, L2Result } from "./types";

function computeRiskScore(risk: TimeToFillRisk) {
  const marketMedian = Math.max(1, risk.marketMedianTimeToFillDays);
  const forecastPressure = risk.estimatedTimeToFillDays / marketMedian;
  const confidencePenalty = risk.confidenceHealth.lowShare;
  const momentumPenalty = typeof risk.stageVelocityDays === "number" ? risk.stageVelocityDays / 14 : 0.5;

  const weighted = forecastPressure * 60 + confidencePenalty * 25 + momentumPenalty * 15;
  return Math.round(weighted * 100) / 100;
}

function buildRationale(risk: TimeToFillRisk) {
  const rationale: string[] = [];

  rationale.push(
    `Forecast projects ${risk.estimatedTimeToFillDays}d to fill versus market median ${Math.round(risk.marketMedianTimeToFillDays)}d.`,
  );

  if (risk.confidenceHealth.totalSamples > 0) {
    rationale.push(`${Math.round(risk.confidenceHealth.lowShare * 100)}% of matches sit in low confidence bands.`);
  } else {
    rationale.push("No confidence samples yet; relying on baseline risk forecast.");
  }

  if (risk.stageVelocityDays === null) {
    rationale.push("No stage movement recorded; requisition momentum is unclear.");
  } else {
    rationale.push(`Average stage velocity ${risk.stageVelocityDays.toFixed(1)}d per hop, dampening speed.`);
  }

  if (risk.riskFlags.length) {
    rationale.push(...risk.riskFlags);
  }

  return rationale;
}

export async function runRiskiestReqs(
  input: L2Input,
  { bypassCache = false }: { bypassCache?: boolean } = {},
): Promise<L2Result> {
  const cacheKey = intelligenceCacheKeys.l2("RISKIEST_REQS", input.tenantId, JSON.stringify(input.scope ?? {}));

  return intelligenceCache.getOrCreate(
    [cacheKey],
    INTELLIGENCE_CACHE_TTLS.l2QueriesMs,
    async () => {
      const risks = await getTimeToFillRisksForTenant(input.tenantId, { bypassCache });

      const items = risks
        .map((risk) => {
          const score = computeRiskScore(risk);
          const rationale = buildRationale(risk);

          return {
            title: risk.jobTitle ?? "Untitled req",
            score,
            rationale,
            references: [
              { type: "job_req", id: risk.jobId, label: risk.jobTitle ?? risk.jobId },
              { type: "signal", label: "Time-to-fill risk forecast" },
              { type: "signal", label: "Confidence health" },
            ],
          } satisfies L2Result["items"][number];
        })
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.title.localeCompare(b.title);
        });

      return {
        question: "RISKIEST_REQS",
        generatedAt: new Date().toISOString(),
        items,
      } satisfies L2Result;
    },
    { bypassCache },
  );
}
