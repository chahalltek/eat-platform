import { z } from "zod";

import { DecisionArtifactStatus, DecisionArtifactType, Prisma, prisma, type DecisionArtifact } from "@/server/db/prisma";
import { withTenantContext } from "@/lib/tenant";

type DecisionArtifactPayload = Prisma.InputJsonValue;

export type DecisionArtifactRecord = DecisionArtifact;

type CreateDecisionArtifactInput = {
  tenantId: string;
  jobId?: string | null;
  candidateIds?: string[];
  type: DecisionArtifactType;
  payload: unknown;
  createdByUserId: string;
  status?: DecisionArtifactStatus;
};

type PublishDecisionArtifactInput = {
  artifactId: string;
  tenantId: string;
  payload?: unknown;
};

type ListDecisionArtifactsInput = {
  tenantId: string;
  jobId?: string;
  candidateId?: string;
  types?: DecisionArtifactType[];
  status?: DecisionArtifactStatus | DecisionArtifactStatus[];
  limit?: number;
};

type GetDecisionArtifactInput = {
  artifactId: string;
  tenantId?: string;
};

function normalizePayload(payload: unknown): DecisionArtifactPayload {
  if (payload === undefined) {
    return {} satisfies DecisionArtifactPayload;
  }

  return payload as DecisionArtifactPayload;
}

function normalizeCandidateIds(candidateIds?: string[]) {
  return (candidateIds ?? []).map((candidateId) => candidateId.trim()).filter(Boolean);
}

export const decisionArtifactSchema = z.object({
  jobId: z.string().trim().optional(),
  candidateId: z.string().trim().optional(),
  candidateIds: z.array(z.string().trim()).optional(),
  type: z.nativeEnum(DecisionArtifactType).default(DecisionArtifactType.RECOMMENDATION),
  payload: z.unknown().default({}),
});

export async function createDecisionArtifact({
  tenantId,
  jobId,
  candidateIds,
  type,
  payload,
  createdByUserId,
  status = DecisionArtifactStatus.DRAFT,
}: CreateDecisionArtifactInput) {
  return prisma.decisionArtifact.create({
    data: {
      tenantId,
      jobId: jobId ?? null,
      candidateIds: normalizeCandidateIds(candidateIds),
      type,
      payload: normalizePayload(payload),
      createdByUserId,
      status,
      publishedAt: status === DecisionArtifactStatus.PUBLISHED ? new Date() : null,
    },
  });
}

export async function publishDecisionArtifact({ artifactId, tenantId, payload }: PublishDecisionArtifactInput) {
  return withTenantContext(tenantId, () =>
    prisma.decisionArtifact.update({
      where: { id: artifactId },
      data: {
        status: DecisionArtifactStatus.PUBLISHED,
        payload: payload === undefined ? undefined : normalizePayload(payload),
        publishedAt: new Date(),
      },
    }),
  );
}

export async function getDecisionArtifact({ artifactId, tenantId }: GetDecisionArtifactInput) {
  return prisma.decisionArtifact.findFirst({
    where: {
      id: artifactId,
      tenantId: tenantId ?? undefined,
    },
  });
}

export async function listDecisionArtifacts({
  tenantId,
  jobId,
  candidateId,
  types,
  status,
  limit,
}: ListDecisionArtifactsInput) {
  return prisma.decisionArtifact.findMany({
    where: {
      tenantId,
      jobId: jobId ?? undefined,
      candidateIds: candidateId ? { has: candidateId } : undefined,
      type: types && types.length > 0 ? { in: types } : undefined,
      status: Array.isArray(status) ? { in: status } : status ?? undefined,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
