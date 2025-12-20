import { DEFAULT_TENANT_ID } from '@/lib/auth/config';
import type { DecisionReceiptInput } from '@/server/decision/decisionReceipts';
import { prisma } from '@/server/db/prisma';

export type CurationCategory =
  | 'Strong decisions'
  | 'Risky but successful decisions'
  | 'Confident but incorrect decisions';

export type DecisionReceiptLearningCase = {
  id: string;
  jobId: string;
  candidateId: string;
  candidateName: string;
  anonymizedName: string;
  decisionType: DecisionReceiptInput["decisionType"];
  drivers: string[];
  risks: string[];
  summary: string;
  confidenceScore: number | null;
  tradeoff: string | null;
  createdAt: string;
  suggestedCategory: CurationCategory;
  coachingAngle: string;
};

function safeArray(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean)
    .slice(0, limit);
}

function clampConfidence(value: unknown) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.min(10, Math.max(0, Number(value.toFixed(1))));
}

function anonymizeName(name: string, id: string) {
  const trimmed = name.trim();
  const initials = trimmed.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  const code = `${id}${name}`
    .split('')
    .reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 7)
    .toString(36)
    .toUpperCase()
    .slice(0, 3);

  return `Candidate ${initials || 'AN'}-${code || '000'}`;
}

function suggestCategory(receipt: { confidenceScore: number | null; risks: string[]; decisionType: DecisionReceiptInput["decisionType"] }): CurationCategory {
  const confidence = receipt.confidenceScore ?? 0;
  const hasRisks = receipt.risks.length > 0;

  if (confidence >= 8 && !hasRisks) return 'Strong decisions';
  if (confidence >= 6 && hasRisks) return 'Risky but successful decisions';
  if (receipt.decisionType === 'REJECT' || receipt.decisionType === 'PASS') return 'Confident but incorrect decisions';
  return hasRisks ? 'Risky but successful decisions' : 'Strong decisions';
}

function buildCoachingAngle(receipt: DecisionReceiptLearningCase) {
  if (receipt.suggestedCategory === 'Strong decisions') {
    return 'Use to coach on crisp recommendations anchored in drivers and confidence.';
  }

  if (receipt.suggestedCategory === 'Risky but successful decisions') {
    return 'Highlight how risks were acknowledged while still moving the req forward.';
  }

  return 'Review where conviction outpaced evidence to prevent repeat misses.';
}

export async function getDecisionReceiptLearningCases(tenantId?: string | null, take = 12): Promise<DecisionReceiptLearningCase[]> {
  const normalizedTenantId = (tenantId ?? DEFAULT_TENANT_ID).trim();

  const events = await prisma.metricEvent.findMany({
    where: { tenantId: normalizedTenantId, eventType: 'DECISION_RECEIPT_CREATED' },
    orderBy: { createdAt: 'desc' },
    take,
  });

  return events.map((entry) => {
    const meta = (entry.meta ?? {}) as Record<string, unknown>;
    const candidateName = typeof meta.candidateName === 'string' ? meta.candidateName : 'Unknown candidate';
    const candidateId = typeof meta.candidateId === 'string' ? meta.candidateId : entry.entityId ?? '';
    const decisionType = (meta.decisionType as DecisionReceiptInput["decisionType"]) ?? 'RECOMMEND';
    const drivers = safeArray(meta.drivers, 3);
    const risks = safeArray(meta.risks, 4);
    const confidenceScore = clampConfidence(meta.confidenceScore);
    const tradeoff = typeof meta.tradeoff === 'string' ? meta.tradeoff : null;
    const summary = typeof meta.summary === 'string' && meta.summary.trim() ? meta.summary.trim() : 'Decision captured for learning.';

    const suggestedCategory = suggestCategory({ confidenceScore, risks, decisionType });

    return {
      id: entry.id,
      jobId: typeof meta.jobId === 'string' ? meta.jobId : entry.entityId ?? '',
      candidateId,
      candidateName,
      anonymizedName: anonymizeName(candidateName, candidateId),
      decisionType,
      drivers,
      risks,
      summary,
      confidenceScore,
      tradeoff,
      createdAt: entry.createdAt.toISOString(),
      suggestedCategory,
      coachingAngle: '',
    } satisfies DecisionReceiptLearningCase;
  })
  .map((receipt) => ({ ...receipt, coachingAngle: buildCoachingAngle(receipt) }));
}
