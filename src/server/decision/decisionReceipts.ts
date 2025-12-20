import { z } from "zod";

import type { IdentityUser } from "@/lib/auth/types";
import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { prisma } from "@/server/db/prisma";
import { recordMetricEvent } from "@/lib/metrics/events";

export const decisionReceiptSchema = z.object({
  jobId: z.string().trim().min(1),
  candidateId: z.string().trim().min(1),
  candidateName: z.string().trim().min(1).default("Unknown candidate"),
  decisionType: z.enum(["RECOMMEND", "SUBMIT", "REJECT", "PASS"]),
  drivers: z.array(z.string().trim()).default([]),
  tradeoff: z.string().trim().optional(),
  confidenceScore: z.number().min(0).max(10).optional(),
  risks: z.array(z.string().trim()).default([]),
  summary: z.string().trim().optional(),
  bullhornTarget: z.enum(["note", "custom_field"]).default("note"),
  shortlistStrategy: z.enum(["quality", "strict", "fast"]).optional(),
});

export type DecisionReceiptInput = z.infer<typeof decisionReceiptSchema>;

export type DecisionReceiptRecord = {
  id: string;
  jobId: string;
  candidateId: string;
  candidateName: string;
  decisionType: DecisionReceiptInput["decisionType"];
  drivers: string[];
  tradeoff: string | null;
  confidenceScore: number | null;
  risks: string[];
  summary: string;
  createdAt: string;
  createdBy: {
    id: string;
    email?: string | null;
    name?: string | null;
  };
  bullhornNote: string;
  bullhornTarget: DecisionReceiptInput["bullhornTarget"];
};

function toTenPointScale(score?: number | null): number | null {
  if (typeof score !== "number" || Number.isNaN(score)) return null;
  if (score > 10) return Math.min(10, Math.round((score / 10) * 10) / 10);
  return Math.min(10, Math.max(0, Math.round(score * 10) / 10));
}

function clampEntries(entries?: string[], limit = 3): string[] {
  return (entries ?? []).map((entry) => entry.trim()).filter(Boolean).slice(0, limit);
}

function defaultTradeoff(decisionType: DecisionReceiptInput["decisionType"], strategy?: DecisionReceiptInput["shortlistStrategy"]) {
  if (strategy === "fast") return "Accepted speed over precision to keep req momentum.";
  if (strategy === "strict") return "Prioritized precision over coverage to protect quality.";
  if (decisionType === "REJECT") return "Declined based on fit or risk signals while preserving ATS workflow.";
  if (decisionType === "PASS") return "Deferred without interrupting ATS state transitions.";
  return "Balanced quality and coverage with recruiter judgment.";
}

function describeDecision(decisionType: DecisionReceiptInput["decisionType"]) {
  const labels: Record<DecisionReceiptInput["decisionType"], string> = {
    RECOMMEND: "Recommendation recorded",
    SUBMIT: "Submission recorded",
    REJECT: "Rejection recorded",
    PASS: "Pass decision recorded",
  };

  return labels[decisionType];
}

function summarizeReceipt(payload: DecisionReceiptInput & { confidenceScore: number | null; drivers: string[]; risks: string[]; tradeoff: string | null }) {
  const driverSummary = payload.drivers.length ? `Drivers: ${payload.drivers.join("; ")}.` : "Drivers: Not captured.";
  const riskSummary = payload.risks.length ? `Risks: ${payload.risks.join("; ")}.` : "Risks: Not captured.";
  const confidence = typeof payload.confidenceScore === "number" ? `${payload.confidenceScore}/10 confidence.` : "Confidence not captured.";
  const tradeoff = payload.tradeoff ? `Tradeoff: ${payload.tradeoff}` : "Tradeoff: Defaulted to recruiter judgment.";

  return `${describeDecision(payload.decisionType)} ${driverSummary} ${riskSummary} ${confidence} ${tradeoff}`;
}

export async function createDecisionReceipt({
  tenantId,
  payload,
  user,
}: {
  tenantId?: string | null;
  payload: DecisionReceiptInput;
  user: IdentityUser;
}): Promise<DecisionReceiptRecord> {
  const normalizedTenantId = (tenantId ?? user.tenantId ?? DEFAULT_TENANT_ID).trim();

  const drivers = clampEntries(payload.drivers, 3);
  const risks = clampEntries(payload.risks, 4);
  const confidenceScore = toTenPointScale(payload.confidenceScore);
  const tradeoff = payload.tradeoff?.trim() || defaultTradeoff(payload.decisionType, payload.shortlistStrategy);

  const baseSummary = payload.summary?.trim() || summarizeReceipt({ ...payload, drivers, risks, confidenceScore, tradeoff });

  const created = await prisma.metricEvent.create({
    data: {
      tenantId: normalizedTenantId,
      eventType: "DECISION_RECEIPT_CREATED",
      entityId: payload.jobId,
      meta: {
        ...payload,
        drivers,
        risks,
        tradeoff,
        confidenceScore,
        summary: baseSummary,
        createdBy: {
          id: user.id,
          email: user.email,
          name: user.displayName,
        },
      },
    },
  });

  const bullhornNote = `${baseSummary} Synced as ${payload.bullhornTarget === "custom_field" ? "custom field payload" : "note"} for auditability.`;

  await recordMetricEvent({
    tenantId: normalizedTenantId,
    eventType: "DECISION_RECEIPT_PUSHED",
    entityId: created.id,
    meta: {
      jobId: payload.jobId,
      candidateId: payload.candidateId,
      target: payload.bullhornTarget,
      summary: bullhornNote,
    },
  });

  return {
    id: created.id,
    jobId: payload.jobId,
    candidateId: payload.candidateId,
    candidateName: payload.candidateName,
    decisionType: payload.decisionType,
    drivers,
    tradeoff,
    confidenceScore,
    risks,
    summary: baseSummary,
    createdAt: created.createdAt.toISOString(),
    createdBy: { id: user.id, email: user.email, name: user.displayName },
    bullhornNote,
    bullhornTarget: payload.bullhornTarget,
  };
}

export async function listDecisionReceipts({
  tenantId,
  jobId,
  candidateId,
  take = 50,
}: {
  tenantId?: string | null;
  jobId: string;
  candidateId?: string | null;
  take?: number;
}): Promise<DecisionReceiptRecord[]> {
  const normalizedTenantId = (tenantId ?? DEFAULT_TENANT_ID).trim();
  const trimmedCandidate = candidateId?.trim();

  const receipts = await prisma.metricEvent.findMany({
    where: {
      tenantId: normalizedTenantId,
      eventType: "DECISION_RECEIPT_CREATED",
      meta: {
        path: ["jobId"],
        equals: jobId,
      },
      ...(trimmedCandidate
        ? {
            AND: [
              {
                meta: {
                  path: ["candidateId"],
                  equals: trimmedCandidate,
                },
              },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
  });

  return receipts
    .map((entry) => {
      const meta = (entry.meta ?? {}) as Record<string, unknown>;
      const createdBy = (meta.createdBy as Record<string, string | null> | undefined) ?? {};
      const jobIdFromMeta = String(meta.jobId ?? entry.entityId ?? "");
      const decisionType = (meta.decisionType as DecisionReceiptInput["decisionType"]) ?? "RECOMMEND";
      const drivers = Array.isArray(meta.drivers) ? (meta.drivers as string[]).filter(Boolean) : [];
      const risks = Array.isArray(meta.risks) ? (meta.risks as string[]).filter(Boolean) : [];
      const confidenceScore = typeof meta.confidenceScore === "number" ? meta.confidenceScore : null;
      const tradeoff = typeof meta.tradeoff === "string" ? meta.tradeoff : null;
      const bullhornTarget = (meta.bullhornTarget as DecisionReceiptInput["bullhornTarget"]) ?? "note";

      const summary =
        typeof meta.summary === "string"
          ? meta.summary
          : summarizeReceipt({
              ...(meta as DecisionReceiptInput),
              decisionType,
              drivers,
              risks,
              confidenceScore,
              tradeoff,
            });

      return {
        id: entry.id,
        jobId: jobIdFromMeta,
        candidateId: String(meta.candidateId ?? ""),
        candidateName: String(meta.candidateName ?? "Unknown candidate"),
        decisionType,
        drivers,
        tradeoff,
        confidenceScore,
        risks,
        summary,
        createdAt: entry.createdAt.toISOString(),
        createdBy: {
          id: String(createdBy.id ?? ""),
          email: createdBy.email ?? null,
          name: createdBy.name ?? null,
        },
        bullhornNote: `${summary} Synced as ${bullhornTarget === "custom_field" ? "custom field payload" : "note"} for auditability.`,
        bullhornTarget,
      } satisfies DecisionReceiptRecord;
    })
    .filter((entry) => entry.jobId === jobId);
}
