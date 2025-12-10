import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";

export type HomeCardMetrics = {
  totalJobs: number | null;
  totalCandidates: number | null;
  testContentRoles: number | null;
  agentRunsLast7d: number | null;
};

export async function getHomeCardMetrics(): Promise<HomeCardMetrics> {
  const tenantId = await getCurrentTenantId();

  const oneWeekAgo = new Date();
  oneWeekAgo.setHours(0, 0, 0, 0);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 6);

  try {
    const [totalJobs, totalCandidates, testContentRoles, agentRunsLast7d] = await Promise.all([
      prisma.jobReq.count({ where: { tenantId } }),
      prisma.candidate.count({ where: { tenantId } }),
      prisma.jobReq.count({ where: { tenantId, sourceType: "Test Content" } }),
      prisma.agentRunLog.count({ where: { tenantId, startedAt: { gte: oneWeekAgo } } }),
    ]);

    return { totalJobs, totalCandidates, testContentRoles, agentRunsLast7d };
  } catch (error) {
    console.error("[Home] Failed to load card metrics", error);
    return { totalJobs: null, totalCandidates: null, testContentRoles: null, agentRunsLast7d: null };
  }
}
