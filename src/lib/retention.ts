import type {
  AgentRunLog,
  Candidate,
  Match,
  MatchResult,
  PrismaClient,
  Tenant,
} from '@/server/db/prisma';
import { Prisma, TenantDeletionMode } from '@/server/db/prisma';

export type RetentionPrisma = Pick<
  PrismaClient,
  |
    'tenant'
  |
    'agentRunLog'
  |
    'match'
  |
    'matchResult'
  |
    'candidate'
  |
    'candidateSkill'
  |
    'jobCandidate'
  |
    'outreachInteraction'
  |
    'featureFlag'
  |
    'jobSkill'
  |
    'jobReq'
  |
    'customer'
  |
    'tenantSubscription'
  |
    'user'
  | 'userIdentity'
>;

export type RetentionPolicy = {
  cutoff: Date;
  mode: TenantDeletionMode;
};

export type ExpiredRecordSelection = {
  agentRunLogIds: string[];
  matchIds: string[];
  matchResultIds: string[];
  candidateIds: string[];
};

export type DeletionSummary = {
  soft: boolean;
  agentRunLogs: number;
  matches: number;
  matchResults: number;
  candidates: number;
  candidateSkills?: number;
  jobCandidates?: number;
  outreachInteractions?: number;
  dependentMatches?: number;
  dependentMatchResults?: number;
  featureFlags?: number;
  jobSkills?: number;
  jobReqs?: number;
  customers?: number;
  tenantSubscriptions?: number;
  users?: number;
  userIdentities?: number;
};

export type TenantRetentionResult = {
  tenantId: string;
  cutoff: Date | null;
  summary: DeletionSummary | null;
};

const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

export function resolveRetentionPolicy(
  tenant: Pick<Tenant, 'dataRetentionDays' | 'deletionMode' | 'id'>,
  now = new Date(),
): RetentionPolicy | null {
  const retentionDays = tenant.dataRetentionDays;

  if (retentionDays === null || retentionDays === undefined) {
    return null;
  }

  if (retentionDays < 0) {
    return null;
  }

  const cutoff = new Date(now.getTime() - retentionDays * MILLIS_PER_DAY);
  const mode = tenant.deletionMode ?? TenantDeletionMode.SOFT_DELETE;

  return { cutoff, mode };
}

function mapIds(records: Array<Pick<AgentRunLog | Match | MatchResult | Candidate, 'id'>>) {
  return records.map((record) => record.id);
}

export async function findExpiredRecords(
  prisma: RetentionPrisma,
  tenantId: string,
  cutoff: Date,
): Promise<ExpiredRecordSelection> {
  const [agentRunLogIds, matchIds, matchResultIds, candidateIds] = await Promise.all([
    prisma.agentRunLog
      .findMany({
        where: { tenantId, startedAt: { lt: cutoff }, deletedAt: null },
        select: { id: true },
      })
      .then(mapIds),
    prisma.match
      .findMany({ where: { tenantId, createdAt: { lt: cutoff }, deletedAt: null }, select: { id: true } })
      .then(mapIds),
    prisma.matchResult
      .findMany({ where: { tenantId, createdAt: { lt: cutoff } }, select: { id: true } })
      .then(mapIds),
    prisma.candidate
      .findMany({ where: { tenantId, updatedAt: { lt: cutoff }, deletedAt: null }, select: { id: true } })
      .then(mapIds),
  ]);

  return { agentRunLogIds, matchIds, matchResultIds, candidateIds };
}

export async function collectTenantData(
  prisma: RetentionPrisma,
  tenantId: string,
): Promise<ExpiredRecordSelection> {
  const [agentRunLogIds, matchIds, matchResultIds, candidateIds] = await Promise.all([
    prisma.agentRunLog.findMany({ where: { tenantId }, select: { id: true } }).then(mapIds),
    prisma.match.findMany({ where: { tenantId }, select: { id: true } }).then(mapIds),
    prisma.matchResult.findMany({ where: { tenantId }, select: { id: true } }).then(mapIds),
    prisma.candidate.findMany({ where: { tenantId }, select: { id: true } }).then(mapIds),
  ]);

  return { agentRunLogIds, matchIds, matchResultIds, candidateIds };
}

async function deleteDependents(
  prisma: RetentionPrisma,
  tenantId: string,
  candidateIds: string[],
) {
  if (candidateIds.length === 0) {
    return {
      candidateSkills: 0,
      jobCandidates: 0,
      outreachInteractions: 0,
      dependentMatches: 0,
      dependentMatchResults: 0,
    };
  }

  const [candidateSkills, jobCandidates, outreachInteractions, dependentMatchResults, dependentMatches] =
    await Promise.all([
      prisma.candidateSkill.deleteMany({ where: { tenantId, candidateId: { in: candidateIds } } }),
      prisma.jobCandidate.deleteMany({ where: { tenantId, candidateId: { in: candidateIds } } }),
      prisma.outreachInteraction.deleteMany({ where: { tenantId, candidateId: { in: candidateIds } } }),
      prisma.matchResult.deleteMany({ where: { tenantId, candidateId: { in: candidateIds } } }),
      prisma.match.deleteMany({ where: { tenantId, candidateId: { in: candidateIds } } }),
    ]);

  return {
    candidateSkills: candidateSkills.count,
    jobCandidates: jobCandidates.count,
    outreachInteractions: outreachInteractions.count,
    dependentMatches: dependentMatches.count,
    dependentMatchResults: dependentMatchResults.count,
  };
}

export async function softDeleteExpiredRecords(
  prisma: RetentionPrisma,
  tenantId: string,
  expired: ExpiredRecordSelection,
  deletionTimestamp = new Date(),
): Promise<DeletionSummary> {
  const [agentRunLogs, matches, matchResults, candidateDetails] = await Promise.all([
    expired.agentRunLogIds.length
      ? prisma.agentRunLog.updateMany({
          where: { tenantId, id: { in: expired.agentRunLogIds } },
          data: { deletedAt: deletionTimestamp, input: {}, output: Prisma.DbNull, errorMessage: null },
        })
      : { count: 0 },
    expired.matchIds.length
      ? prisma.match.updateMany({
          where: { tenantId, id: { in: expired.matchIds } },
          data: { deletedAt: deletionTimestamp, scoreBreakdown: Prisma.JsonNull },
        })
      : { count: 0 },
    expired.matchResultIds.length
      ? prisma.matchResult.updateMany({
          where: { tenantId, id: { in: expired.matchResultIds } },
          data: { reasons: Prisma.JsonNull },
        })
      : { count: 0 },
    expired.candidateIds.length
      ? prisma.candidate.updateMany({
          where: { tenantId, id: { in: expired.candidateIds } },
          data: {
            deletedAt: deletionTimestamp,
            fullName: 'Removed Candidate',
            email: null,
            phone: null,
            location: null,
            currentTitle: null,
            currentCompany: null,
            totalExperienceYears: null,
            seniorityLevel: null,
            summary: null,
            rawResumeText: null,
            sourceType: null,
            sourceTag: null,
            parsingConfidence: null,
            status: 'deleted',
          },
        })
      : { count: 0 },
  ]);

  return {
    soft: true,
    agentRunLogs: agentRunLogs.count,
    matches: matches.count,
    matchResults: matchResults.count,
    candidates: candidateDetails.count,
  };
}

export async function hardDeleteExpiredRecords(
  prisma: RetentionPrisma,
  tenantId: string,
  expired: ExpiredRecordSelection,
): Promise<DeletionSummary> {
  const dependentCounts = await deleteDependents(prisma, tenantId, expired.candidateIds);

  const [matchResults, matches, agentRunLogs, candidates] = await Promise.all([
    expired.matchResultIds.length
      ? prisma.matchResult.deleteMany({ where: { tenantId, id: { in: expired.matchResultIds } } })
      : { count: 0 },
    expired.matchIds.length
      ? prisma.match.deleteMany({ where: { tenantId, id: { in: expired.matchIds } } })
      : { count: 0 },
    expired.agentRunLogIds.length
      ? prisma.agentRunLog.deleteMany({ where: { tenantId, id: { in: expired.agentRunLogIds } } })
      : { count: 0 },
    expired.candidateIds.length
      ? prisma.candidate.deleteMany({ where: { tenantId, id: { in: expired.candidateIds } } })
      : { count: 0 },
  ]);

  return {
    soft: false,
    agentRunLogs: agentRunLogs.count,
    matches: matches.count,
    matchResults: matchResults.count,
    candidates: candidates.count,
    ...dependentCounts,
  };
}

export async function processTenantRetention(
  prisma: RetentionPrisma,
  tenant: Tenant,
  now = new Date(),
): Promise<TenantRetentionResult> {
  const policy = resolveRetentionPolicy(tenant, now);

  if (!policy) {
    return { tenantId: tenant.id, cutoff: null, summary: null };
  }

  const expired = await findExpiredRecords(prisma, tenant.id, policy.cutoff);
  const noExpiredRecords =
    expired.agentRunLogIds.length +
      expired.matchIds.length +
      expired.matchResultIds.length +
      expired.candidateIds.length ===
    0;

  if (noExpiredRecords) {
    return {
      tenantId: tenant.id,
      cutoff: policy.cutoff,
      summary: {
        soft: policy.mode === TenantDeletionMode.SOFT_DELETE,
        agentRunLogs: 0,
        matches: 0,
        matchResults: 0,
        candidates: 0,
      },
    };
  }

  const summary =
    policy.mode === TenantDeletionMode.HARD_DELETE
      ? await hardDeleteExpiredRecords(prisma, tenant.id, expired)
      : await softDeleteExpiredRecords(prisma, tenant.id, expired, now);

  return { tenantId: tenant.id, cutoff: policy.cutoff, summary };
}

export async function deleteTenantData(
  prisma: RetentionPrisma,
  tenantId: string,
  mode: TenantDeletionMode = TenantDeletionMode.HARD_DELETE,
  now = new Date(),
) {
  const fullSelection = await collectTenantData(prisma, tenantId);

  if (mode === TenantDeletionMode.HARD_DELETE) {
    const summary = await hardDeleteExpiredRecords(prisma, tenantId, fullSelection);

    const tenantUserIds = await prisma.user
      .findMany({ where: { tenantId }, select: { id: true } })
      .then((records) => records.map((record) => record.id));

    const [
      featureFlags,
      jobSkills,
      jobReqs,
      customers,
      tenantSubscriptions,
      userIdentities,
      users,
    ] = await Promise.all([
      prisma.featureFlag.deleteMany({ where: { tenantId } }),
      prisma.jobSkill.deleteMany({ where: { tenantId } }),
      prisma.jobReq.deleteMany({ where: { tenantId } }),
      prisma.customer.deleteMany({ where: { tenantId } }),
      prisma.tenantSubscription.deleteMany({ where: { tenantId } }),
      prisma.userIdentity.deleteMany({ where: { userId: { in: tenantUserIds } } }),
      prisma.user.deleteMany({ where: { tenantId } }),
    ]);

    return {
      ...summary,
      featureFlags: featureFlags.count,
      jobSkills: jobSkills.count,
      jobReqs: jobReqs.count,
      customers: customers.count,
      tenantSubscriptions: tenantSubscriptions.count,
      users: users.count,
      userIdentities: userIdentities.count,
    };
  }

  return softDeleteExpiredRecords(prisma, tenantId, fullSelection, now);
}

export async function runTenantRetentionJob(prisma: RetentionPrisma, now = new Date()) {
  const tenants = await prisma.tenant.findMany();
  const results = [] as TenantRetentionResult[];

  for (const tenant of tenants) {
    const result = await processTenantRetention(prisma, tenant, now);
    results.push(result);
  }

  const processed = results.filter((result) => result.summary !== null);
  const totalDeletes = processed.reduce(
    (counts, result) => {
      const summary = result.summary!;
      counts.agentRunLogs += summary.agentRunLogs;
      counts.matchResults += summary.matchResults;
      counts.matches += summary.matches;
      counts.candidates += summary.candidates;
      return counts;
    },
    { agentRunLogs: 0, matches: 0, matchResults: 0, candidates: 0 },
  );

  return {
    message: 'Tenant data retention completed',
    details: {
      processed: tenants.length,
      actedOn: processed.length,
      deletions: totalDeletes,
      results,
      runAt: now.toISOString(),
    },
  };
}
