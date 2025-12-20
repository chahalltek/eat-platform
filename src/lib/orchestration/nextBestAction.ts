import { JobCandidateStatus } from "@/server/db/prisma";

import {
  runNextBestAction,
  type NextBestActionInput,
  type NextBestActionResult,
} from "@/server/agents/nextBestAction";
import { getMarketSignals } from "@/lib/market/marketSignals";
import { recordMetricEvent } from "@/lib/metrics/events";
import { prisma } from "@/server/db/prisma";

export type NextBestActionTriggerReason = "job_aging" | "low_confidence_pipeline" | "market_risk";

const NBA_TRIGGER_DEBOUNCE_MS = 60 * 60 * 1000; // one hour
const lastTriggerAt = new Map<string, number>();

function shouldTrigger(tenantId: string, jobId: string, reason: NextBestActionTriggerReason) {
  const key = `${tenantId}:${jobId}:${reason}`;
  const now = Date.now();
  const last = lastTriggerAt.get(key) ?? 0;

  if (now - last < NBA_TRIGGER_DEBOUNCE_MS) {
    return false;
  }

  lastTriggerAt.set(key, now);
  return true;
}

function bucketScore(score: number) {
  if (score >= 75) return "high" as const;
  if (score >= 50) return "medium" as const;
  return "low" as const;
}

async function calculateConfidence(jobId: string, tenantId: string) {
  const matchResults = await prisma.matchResult.findMany({
    where: { jobReqId: jobId, tenantId },
    select: { score: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const buckets = { low: 0, medium: 0, high: 0 } satisfies Record<"low" | "medium" | "high", number>;

  for (const result of matchResults) {
    buckets[bucketScore(result.score)] += 1;
  }

  const sampleSize = matchResults.length || 0;
  const divisor = sampleSize || 1;

  return {
    distribution: {
      low: buckets.low / divisor,
      medium: buckets.medium / divisor,
      high: buckets.high / divisor,
      sampleSize,
    },
    sampleSize,
  };
}

async function calculatePipelineHealth(jobId: string, tenantId: string) {
  const job = await prisma.jobReq.findUnique({
    where: { id: jobId, tenantId },
    select: { createdAt: true },
  });

  const totalCandidates = await prisma.jobCandidate.count({ where: { jobReqId: jobId, tenantId } });
  const shortlisted = await prisma.jobCandidate.count({
    where: { jobReqId: jobId, tenantId, status: JobCandidateStatus.SHORTLISTED },
  });

  const agingDays = job ? Math.max(0, Math.floor((Date.now() - job.createdAt.getTime()) / 86_400_000)) : 0;
  const shortlistRate = totalCandidates > 0 ? shortlisted / totalCandidates : 0;

  return { agingDays, totalCandidates, shortlistRate } as const;
}

async function calculateMarketSignals(jobId: string, tenantId: string) {
  const job = await prisma.jobReq.findUnique({
    where: { id: jobId, tenantId },
    select: { location: true },
  });

  const marketSignals = await getMarketSignals({
    roleFamily: undefined,
    region: job?.location ?? undefined,
  });

  const scarcityIndex = marketSignals.skillScarcity.reduce((max, entry) => Math.max(max, entry.scarcityIndex), 0);
  const estimatedTimeToFillDays = marketSignals.timeToFillBenchmarks[0]?.p90Days ?? null;
  const marketRisk: "low" | "medium" | "high" =
    scarcityIndex >= 75 ? "high" : scarcityIndex >= 55 ? "medium" : "low";

  return { marketRisk, scarcityIndex, estimatedTimeToFillDays } as const;
}

export async function evaluateNextBestActionTriggers({
  jobId,
  tenantId,
}: {
  jobId: string;
  tenantId: string;
}): Promise<NextBestActionResult | null> {
  const job = await prisma.jobReq.findUnique({
    where: { id: jobId, tenantId },
    select: { id: true, title: true, status: true },
  });

  if (!job) {
    return null;
  }

  const [confidence, pipeline, market] = await Promise.all([
    calculateConfidence(jobId, tenantId),
    calculatePipelineHealth(jobId, tenantId),
    calculateMarketSignals(jobId, tenantId),
  ]);

  const triggerReasons: NextBestActionTriggerReason[] = [];

  if (pipeline.agingDays >= 21 && shouldTrigger(tenantId, jobId, "job_aging")) {
    triggerReasons.push("job_aging");
  }

  if (confidence.sampleSize >= 5 && confidence.distribution.low >= 0.5 && shouldTrigger(tenantId, jobId, "low_confidence_pipeline")) {
    triggerReasons.push("low_confidence_pipeline");
  }

  if (market.marketRisk === "high" && shouldTrigger(tenantId, jobId, "market_risk")) {
    triggerReasons.push("market_risk");
  }

  if (triggerReasons.length === 0) {
    return null;
  }

  const nextBestActionInput: NextBestActionInput = {
    jobId,
    pipelineHealth: {
      agingDays: pipeline.agingDays,
      shortlistRate: pipeline.shortlistRate,
      totalCandidates: pipeline.totalCandidates,
      velocity: confidence.sampleSize > 0 ? confidence.sampleSize / Math.max(1, pipeline.agingDays || 1) : 0,
      triggerReasons,
    },
    confidenceDistribution: confidence.distribution,
    eteSignals: market,
    sourceType: "system",
    sourceTag: triggerReasons.join(","),
  };

  const recommendation = await runNextBestAction(nextBestActionInput);

  await recordMetricEvent({
    tenantId,
    eventType: "NEXT_BEST_ACTION_TRIGGERED",
    entityId: jobId,
    meta: {
      triggerReasons,
      jobTitle: job.title,
      jobStatus: job.status,
      sampleSize: confidence.sampleSize,
    },
  });

  return recommendation;
}
