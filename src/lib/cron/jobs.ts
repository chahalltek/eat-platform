import { runScheduledComplianceScan } from "@/lib/agents/comply";
import { captureWeeklyMatchQualitySnapshots } from "@/lib/learning/matchQuality";
import { prisma } from "@/server/db/prisma";
import { prismaAdmin } from "@/lib/prismaAdmin";
import { runJudgmentMemoryAggregation } from "@/lib/judgmentMemory/aggregator";
import { runLearningAggregation } from "@/lib/network/aggregateLearning";
import { runTenantRetentionJob } from "@/lib/retention";

export type CronJobResult = {
  message: string;
  details?: Record<string, unknown>;
};

export type CronJobCategory = "aggregation" | "forecasting" | "benchmark" | "backfill" | "governance" | "health";

export type CronJob = {
  name: string;
  description?: string;
  jobType: CronJobCategory;
  run: () => Promise<CronJobResult>;
};

export const cronJobs: Record<string, CronJob> = {
  "daily-health-check": {
    name: "daily-health-check",
    description: "Collects basic metrics to confirm the platform is healthy.",
    jobType: "health",
    run: async () => {
      const [userCount, candidateCount, jobReqCount, matchResultCount] = await Promise.all([
        prisma.user.count(),
        prisma.candidate.count(),
        prisma.jobReq.count(),
        prisma.matchResult.count(),
      ]);

      return {
        message: "Health check completed successfully.",
        details: {
          users: userCount,
          candidates: candidateCount,
          jobReqs: jobReqCount,
          matchResults: matchResultCount,
          checkedAt: new Date().toISOString(),
        },
      };
    },
  },
  "tenant-data-retention": {
    name: "tenant-data-retention",
    description: "Applies tenant-level data retention and deletion rules.",
    jobType: "backfill",
    run: () => runTenantRetentionJob(prismaAdmin),
  },
  "compliance-scan": {
    name: "compliance-scan",
    description: "Runs TS-A6 COMPLY to classify data, enforce retention, and log access events.",
    jobType: "governance",
    run: async () => {
      const result = await runScheduledComplianceScan(prismaAdmin);

      return {
        message: "Compliance scan completed",
        details: result,
      } satisfies CronJobResult;
    },
  },
  "match-quality-snapshot": {
    name: "match-quality-snapshot",
    description: "Captures weekly Match Quality Index snapshots for each tenant.",
    jobType: "benchmark",
    run: async () => {
      const tenants = await prisma.tenant.findMany({ select: { id: true } });

      let snapshotsCreated = 0;
      for (const tenant of tenants) {
        const snapshots = await captureWeeklyMatchQualitySnapshots(tenant.id);
        snapshotsCreated += snapshots.length;
      }

      return {
        message: "Match Quality snapshots captured",
        details: { tenantsProcessed: tenants.length, snapshotsCreated },
      } satisfies CronJobResult;
    },
  },
  "learning-aggregate": {
    name: "learning-aggregate",
    description: "Aggregates privacy-safe learning signals across opted-in tenants (weekly).",
    jobType: "aggregation",
    run: async () => {
      const result = await runLearningAggregation();

      return {
        message: "Learning aggregates captured",
        details: result,
      } satisfies CronJobResult;
    },
  },
  "judgment-memory-aggregate": {
    name: "judgment-memory-aggregate",
    description: "Batches institutional judgment signals (read-only, no enforcement).",
    jobType: "aggregation",
    run: async () => {
      const result = await runJudgmentMemoryAggregation();

      return {
        message: "Judgment memory aggregates captured",
        details: result,
      } satisfies CronJobResult;
    },
  },
};
