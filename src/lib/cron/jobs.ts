import { prisma } from "@/lib/prisma";
import { prismaAdmin } from "@/lib/prismaAdmin";
import { runTenantRetentionJob } from "@/lib/retention";

export type CronJobResult = {
  message: string;
  details?: Record<string, unknown>;
};

export type CronJob = {
  name: string;
  description?: string;
  run: () => Promise<CronJobResult>;
};

export const cronJobs: Record<string, CronJob> = {
  "daily-health-check": {
    name: "daily-health-check",
    description: "Collects basic metrics to confirm the platform is healthy.",
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
    run: () => runTenantRetentionJob(prismaAdmin),
  },
};
