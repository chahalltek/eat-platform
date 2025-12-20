import { createHash } from "node:crypto";
import { z } from "zod";

import type { IdentityUser } from "@/lib/auth/types";
import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { prisma } from "@/server/db/prisma";
import { recordMetricEvent } from "@/lib/metrics/events";
<<<<<<< ours
import { recordAuditEvent } from "@/lib/audit/trail";

type VocabularyEntry = {
  key: string;
  label: string;
  hints: string[];
};

const TRADEOFF_VOCABULARY: VocabularyEntry[] = [
  {
    key: "speed_over_precision",
    label: "Speed over precision to keep requisition momentum.",
    hints: ["speed", "momentum", "fast", "latency"],
  },
  {
    key: "precision_over_coverage",
    label: "Precision over coverage to protect quality.",
    hints: ["precision", "strict", "quality", "signal"],
  },
  {
    key: "balanced_quality_coverage",
    label: "Balanced quality and coverage with recruiter judgment.",
    hints: ["balance", "balanced", "coverage", "judgment"],
  },
  {
    key: "workflow_safe_decline",
    label: "Protected ATS workflow while declining a profile.",
    hints: ["workflow", "ats", "declined", "pass", "reject"],
  },
];

const RISK_VOCABULARY: VocabularyEntry[] = [
  {
    key: "skill_gap",
    label: "Skill or coverage gap",
    hints: ["skill", "must-have", "coverage", "ramp"],
  },
  {
    key: "experience_gap",
    label: "Experience below target",
    hints: ["experience", "target", "junior", "senior"],
  },
  {
    key: "location_mismatch",
    label: "Location or availability mismatch",
    hints: ["location", "timezone", "time zone", "commute", "availability"],
  },
  {
    key: "data_quality_risk",
    label: "Data quality or confidence risk",
    hints: ["confidence", "data", "validation", "band"],
  },
];

export const CONFIDENCE_FRAMES = {
  HIGH: "High confidence framing (8-10 on a 10pt scale).",
  MEDIUM: "Moderate confidence framing (5-7 on a 10pt scale).",
  LOW: "Low confidence framing (0-4 on a 10pt scale).",
} as const;

const CUSTOM_TRADEOFF_LABEL = "Custom tradeoff captured";
const CUSTOM_RISK_LABEL = "Other risk captured";

const recommendationFeedbackSchema = z.object({
  recommendedOutcome: z.enum(["shortlist", "pass"]).optional(),
  alignment: z.enum(["accept", "override", "disagree"]).default("accept"),
  rationale: z
    .string()
    .trim()
    .max(280, { message: "Rationale should be concise (under 280 chars)." })
    .optional(),
});
=======
import {
  describeAssignment,
  type ReqArchetypeAssignment,
  type ReqArchetypeDefinition,
  reqArchetypeIdTuple,
} from "@/lib/archetypes/reqArchetypes";
import { extractArchetypeFromIntent } from "@/lib/jobIntent";

const archetypeIdEnum = z.enum(reqArchetypeIdTuple);
>>>>>>> theirs

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
<<<<<<< ours
  recommendation: recommendationFeedbackSchema.optional(),
=======
  archetype: z
    .object({
      id: archetypeIdEnum,
      source: z.enum(["auto", "manual"]).default("manual"),
      reason: z.string().trim().optional(),
      confidence: z.number().min(0).max(1).optional(),
    })
    .optional(),
>>>>>>> theirs
});

export type DecisionReceiptInput = z.infer<typeof decisionReceiptSchema>;
export type RecommendationFeedback = z.infer<typeof recommendationFeedbackSchema>;

<<<<<<< ours
export type DecisionAuditContext = {
  auditEventId: string | null;
  hash: string;
  computedHash: string;
  previousHash: string | null;
  chainPosition: number;
  chainValid: boolean;
};

export type DecisionGovernanceSignals = {
  missingSignals: Array<"summary" | "drivers" | "risks" | "confidence" | "recommendation">;
  overconfidence: boolean;
  repeatedOverrides: boolean;
  overrideCount: number;
  overrideRate: number;
  explainability: string[];
};

type BaseDecisionReceiptRecord = {
=======
type DecisionReceiptArchetype = ReqArchetypeAssignment & ReqArchetypeDefinition;

export type DecisionReceiptRecord = {
>>>>>>> theirs
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
  recommendation: RecommendationFeedback | null;
  createdAt: string;
  createdBy: {
    id: string;
    email?: string | null;
    name?: string | null;
  };
  bullhornNote: string;
  bullhornTarget: DecisionReceiptInput["bullhornTarget"];
<<<<<<< ours
<<<<<<< ours
  auditContext?: Partial<Pick<DecisionAuditContext, "auditEventId" | "hash" | "previousHash" | "chainPosition">>;
};

export type DecisionReceiptRecord = BaseDecisionReceiptRecord & {
  governance: DecisionGovernanceSignals;
  audit: DecisionAuditContext;
=======
  standardizedTradeoff: string | null;
  standardizedTradeoffKey: string | null;
  standardizedRisks: string[];
  standardizedRiskKeys: string[];
  confidenceFrame: keyof typeof CONFIDENCE_FRAMES | null;
>>>>>>> theirs
=======
  archetype: DecisionReceiptArchetype | null;
>>>>>>> theirs
};

function toTenPointScale(score?: number | null): number | null {
  if (typeof score !== "number" || Number.isNaN(score)) return null;
  if (score > 10) return Math.min(10, Math.round((score / 10) * 10) / 10);
  return Math.min(10, Math.max(0, Math.round(score * 10) / 10));
}

function clampEntries(entries?: string[], limit = 3): string[] {
  return (entries ?? []).map((entry) => entry.trim()).filter(Boolean).slice(0, limit);
}

function matchVocabulary(value: string | null, vocabulary: VocabularyEntry[], customLabel: string): { key: string; label: string } | null {
  if (!value) return null;

  const normalized = value.toLowerCase();
  const match = vocabulary.find((entry) => entry.hints.some((hint) => normalized.includes(hint)) || normalized.includes(entry.key.replace(/_/g, " ")));

  if (match) {
    return { key: match.key, label: match.label };
  }

  return { key: "custom", label: customLabel };
}

export function standardizeTradeoff(tradeoff: string | null): { key: string; label: string } | null {
  return matchVocabulary(tradeoff, TRADEOFF_VOCABULARY, CUSTOM_TRADEOFF_LABEL);
}

export function standardizeRisks(risks: string[]): { labels: string[]; keys: string[] } {
  const labels: string[] = [];
  const keys: string[] = [];
  const seenKeys = new Set<string>();

  risks.forEach((risk) => {
    const entry = matchVocabulary(risk, RISK_VOCABULARY, CUSTOM_RISK_LABEL);
    if (!entry) return;
    if (seenKeys.has(entry.key)) return;

    seenKeys.add(entry.key);
    keys.push(entry.key);
    labels.push(entry.label);
  });

  return { labels, keys };
}

export function frameConfidence(confidenceScore: number | null): keyof typeof CONFIDENCE_FRAMES | null {
  if (typeof confidenceScore !== "number") return null;
  if (confidenceScore >= 8) return "HIGH";
  if (confidenceScore >= 5) return "MEDIUM";
  if (confidenceScore >= 0) return "LOW";
  return null;
}

function normalizeRecommendationFeedback(value?: RecommendationFeedback | null): RecommendationFeedback | null {
  if (!value) return null;

  const recommendedOutcome = value.recommendedOutcome === "shortlist" ? "shortlist" : value.recommendedOutcome === "pass" ? "pass" : undefined;
  const alignment: RecommendationFeedback["alignment"] =
    value.alignment === "override" || value.alignment === "disagree" ? value.alignment : "accept";
  const rationale = typeof value.rationale === "string" ? value.rationale.trim().slice(0, 280) : "";

  if (!recommendedOutcome && alignment === "accept" && rationale.length === 0) {
    return null;
  }

  return {
    recommendedOutcome,
    alignment,
    rationale: rationale.length > 0 ? rationale : undefined,
  };
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

<<<<<<< ours
type ReceiptSummaryInput = DecisionReceiptInput & {
  confidenceScore: number | null;
  drivers: string[];
  risks: string[];
  tradeoff: string | null;
  recommendation?: RecommendationFeedback | null;
};

function summarizeReceipt(payload: ReceiptSummaryInput) {
=======
function summarizeReceipt(
  payload: DecisionReceiptInput & {
    confidenceScore: number | null;
    drivers: string[];
    risks: string[];
    tradeoff: string | null;
    archetype: DecisionReceiptArchetype | null;
  },
) {
>>>>>>> theirs
  const driverSummary = payload.drivers.length ? `Drivers: ${payload.drivers.join("; ")}.` : "Drivers: Not captured.";
  const riskSummary = payload.risks.length ? `Risks: ${payload.risks.join("; ")}.` : "Risks: Not captured.";
  const confidence = typeof payload.confidenceScore === "number" ? `${payload.confidenceScore}/10 confidence.` : "Confidence not captured.";
  const tradeoff = payload.tradeoff ? `Tradeoff: ${payload.tradeoff}` : "Tradeoff: Defaulted to recruiter judgment.";
<<<<<<< ours
  const recommendationSummary = payload.recommendation
    ? `Recommendation response: ${payload.recommendation.alignment ?? "accept"}${payload.recommendation.rationale ? ` (${payload.recommendation.rationale})` : ""}.`
    : "Recommendation response not captured.";

  return `${describeDecision(payload.decisionType)} ${driverSummary} ${riskSummary} ${confidence} ${tradeoff} ${recommendationSummary}`;
}

type HashInput = {
  tenantId: string;
  jobId: string;
  candidateId: string;
  decisionType: DecisionReceiptInput["decisionType"];
  drivers: string[];
  risks: string[];
  tradeoff: string | null;
  confidenceScore: number | null;
  summary: string;
  recommendation: RecommendationFeedback | null;
  createdAt: string;
  createdBy: { id: string; email?: string | null; name?: string | null };
  previousHash: string | null;
};

function computeDecisionHash(payload: HashInput) {
  const normalized = {
    tenantId: payload.tenantId,
    jobId: payload.jobId,
    candidateId: payload.candidateId,
    decisionType: payload.decisionType,
    drivers: [...payload.drivers].sort(),
    risks: [...payload.risks].sort(),
    tradeoff: payload.tradeoff,
    confidenceScore: payload.confidenceScore,
    summary: payload.summary,
    recommendation: payload.recommendation
      ? {
          recommendedOutcome: payload.recommendation.recommendedOutcome ?? null,
          alignment: payload.recommendation.alignment ?? null,
          rationale: payload.recommendation.rationale ?? null,
        }
      : null,
    createdAt: payload.createdAt,
    createdBy: payload.createdBy,
    previousHash: payload.previousHash,
  };

  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

function computeGovernanceSignals({
  drivers,
  risks,
  confidenceScore,
  summary,
  recommendation,
  overrideHistory,
}: {
  drivers: string[];
  risks: string[];
  confidenceScore: number | null;
  summary: string;
  recommendation: RecommendationFeedback | null;
  overrideHistory: Array<RecommendationFeedback["alignment"] | undefined>;
}): DecisionGovernanceSignals {
  const missingSignals: DecisionGovernanceSignals["missingSignals"] = [];
  if (!summary.trim()) missingSignals.push("summary");
  if (!drivers.length) missingSignals.push("drivers");
  if (!risks.length) missingSignals.push("risks");
  if (confidenceScore === null) missingSignals.push("confidence");
  if (!recommendation) missingSignals.push("recommendation");

  const overrideCount = overrideHistory.filter(
    (alignment) => alignment === "override" || alignment === "disagree",
  ).length;
  const overrideRate = overrideHistory.length ? Math.min(1, overrideCount / overrideHistory.length) : 0;
  const repeatedOverrides = overrideCount >= 2 && overrideRate >= 0.5;
  const overconfidence = confidenceScore !== null && confidenceScore >= 8 && (!drivers.length || !risks.length);

  const explainability: string[] = [];
  explainability.push(drivers.length ? `${drivers.length} drivers captured` : "Drivers missing");
  explainability.push(risks.length ? `${risks.length} risks captured` : "Risks missing");
  explainability.push(
    confidenceScore !== null ? `Confidence recorded (${confidenceScore.toFixed(1)}/10)` : "Confidence missing",
  );
  explainability.push(
    recommendation
      ? `Recommendation alignment: ${recommendation.alignment ?? "accept"}`
      : "Recommendation rationale missing",
  );

  return {
    missingSignals,
    overconfidence,
    repeatedOverrides,
    overrideCount,
    overrideRate,
    explainability,
  };
=======
  const archetype = payload.archetype ? `Archetype: ${payload.archetype.label}.` : "";

  return `${describeDecision(payload.decisionType)} ${driverSummary} ${riskSummary} ${confidence} ${tradeoff} ${archetype}`.trim();
}

async function resolveJobArchetype(jobId: string, tenantId: string): Promise<DecisionReceiptArchetype | null> {
  const jobIntent = await prisma.jobIntent.findFirst({
    where: { jobReqId: jobId, tenantId },
    select: { intent: true },
  });

  return extractArchetypeFromIntent(jobIntent?.intent);
>>>>>>> theirs
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
  const createdAt = new Date();

  const drivers = clampEntries(payload.drivers, 3);
  const risks = clampEntries(payload.risks, 4);
  const confidenceScore = toTenPointScale(payload.confidenceScore);
<<<<<<< ours
  const tradeoff = payload.tradeoff?.trim() || defaultTradeoff(payload.decisionType, payload.shortlistStrategy);
  const recommendation = normalizeRecommendationFeedback(payload.recommendation);
  const standardizedTradeoff = standardizeTradeoff(tradeoff);
  const { labels: standardizedRisks, keys: standardizedRiskKeys } = standardizeRisks(risks);
  const confidenceFrame = frameConfidence(confidenceScore);

  const baseSummary =
    payload.summary?.trim() ||
    summarizeReceipt({ ...payload, drivers, risks, confidenceScore, tradeoff, recommendation });

  const previousReceipts = await prisma.metricEvent.findMany({
    where: {
      tenantId: normalizedTenantId,
      eventType: "DECISION_RECEIPT_CREATED",
      meta: {
        path: ["jobId"],
        equals: payload.jobId,
      },
      AND: [
        {
          meta: {
            path: ["candidateId"],
            equals: payload.candidateId,
          },
        },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  const previousMeta = (previousReceipts.at(-1)?.meta ?? {}) as Record<string, unknown>;
  const previousAudit = (previousMeta.audit as Record<string, unknown> | undefined) ?? {};
  const previousHash = typeof previousAudit.hash === "string" ? previousAudit.hash : null;
  const previousChainPosition =
    typeof previousAudit.chainPosition === "number" ? previousAudit.chainPosition : previousReceipts.length;

  const overrideHistory = previousReceipts
    .map((entry) => {
      const meta = (entry.meta ?? {}) as Record<string, unknown>;
      const rec = normalizeRecommendationFeedback(meta.recommendation as RecommendationFeedback | null | undefined);
      return rec?.alignment;
    })
    .filter(Boolean);

  const governance = computeGovernanceSignals({
    drivers,
    risks,
    confidenceScore,
    summary: baseSummary,
    recommendation,
    overrideHistory: [...overrideHistory, recommendation?.alignment],
  });

  const hash = computeDecisionHash({
    tenantId: normalizedTenantId,
    jobId: payload.jobId,
    candidateId: payload.candidateId,
    decisionType: payload.decisionType,
    drivers,
    risks,
    tradeoff,
    confidenceScore,
    summary: baseSummary,
    recommendation,
    createdAt: createdAt.toISOString(),
    createdBy: {
      id: user.id,
      email: user.email,
      name: user.displayName,
    },
    previousHash,
  });

  const auditEvent = await recordAuditEvent({
    userId: user.id,
    action: "DECISION_RECEIPT_RECORDED",
    resource: "decision-receipt",
    resourceId: payload.candidateId,
    metadata: {
      tenantId: normalizedTenantId,
      jobId: payload.jobId,
      candidateId: payload.candidateId,
      decisionType: payload.decisionType,
      hash,
      previousHash,
      chainPosition: previousChainPosition + 1,
      governance,
    },
  });
=======
  const archetype =
    describeAssignment(payload.archetype ?? null) ?? (await resolveJobArchetype(payload.jobId, normalizedTenantId));
  const tradeoff =
    payload.tradeoff?.trim() ||
    archetype?.defaultTradeoff ||
    defaultTradeoff(payload.decisionType, payload.shortlistStrategy);

  const baseSummary =
    payload.summary?.trim() ||
    summarizeReceipt({ ...payload, drivers, risks, confidenceScore, tradeoff, archetype });
>>>>>>> theirs

  const created = await prisma.metricEvent.create({
    data: {
      tenantId: normalizedTenantId,
      eventType: "DECISION_RECEIPT_CREATED",
      entityId: payload.jobId,
      createdAt,
      meta: {
        ...payload,
        drivers,
        risks,
        tradeoff,
        confidenceScore,
        recommendation,
        standardizedTradeoff: standardizedTradeoff?.label ?? null,
        standardizedTradeoffKey: standardizedTradeoff?.key ?? null,
        standardizedRisks,
        standardizedRiskKeys,
        confidenceFrame,
        summary: baseSummary,
        archetype: archetype ? { id: archetype.id, source: archetype.source, reason: archetype.reason, confidence: archetype.confidence } : undefined,
        createdBy: {
          id: user.id,
          email: user.email,
          name: user.displayName,
        },
        governance,
        audit: {
          hash,
          previousHash,
          chainPosition: previousChainPosition + 1,
          auditEventId: auditEvent.id,
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
      recommendation,
      decisionType: payload.decisionType,
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
    recommendation,
    createdAt: created.createdAt.toISOString(),
    createdBy: { id: user.id, email: user.email, name: user.displayName },
    bullhornNote,
    bullhornTarget: payload.bullhornTarget,
<<<<<<< ours
<<<<<<< ours
    governance,
    audit: {
      auditEventId: auditEvent.id,
      hash,
      computedHash: hash,
      previousHash,
      chainPosition: previousChainPosition + 1,
      chainValid: true,
    },
=======
    standardizedTradeoff: standardizedTradeoff?.label ?? null,
    standardizedTradeoffKey: standardizedTradeoff?.key ?? null,
    standardizedRisks,
    standardizedRiskKeys,
    confidenceFrame,
>>>>>>> theirs
=======
    archetype: archetype ?? null,
>>>>>>> theirs
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

<<<<<<< ours
  const chronological = [...receipts].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const overrideHistory: Array<RecommendationFeedback["alignment"] | undefined> = [];
  const mapped: DecisionReceiptRecord[] = [];

  for (const entry of chronological) {
    const meta = (entry.meta ?? {}) as Record<string, unknown>;
    const createdBy = (meta.createdBy as Record<string, string | null> | undefined) ?? {};
    const jobIdFromMeta = typeof meta.jobId === "string" ? meta.jobId : entry.entityId ?? "";
    const decisionType = (meta.decisionType as DecisionReceiptInput["decisionType"]) ?? "RECOMMEND";
    const drivers = Array.isArray(meta.drivers) ? (meta.drivers as string[]).filter(Boolean) : [];
    const risks = Array.isArray(meta.risks) ? (meta.risks as string[]).filter(Boolean) : [];
    const confidenceScore = typeof meta.confidenceScore === "number" ? toTenPointScale(meta.confidenceScore) : null;
    const tradeoff = typeof meta.tradeoff === "string" ? meta.tradeoff : null;
    const bullhornTarget = (meta.bullhornTarget as DecisionReceiptInput["bullhornTarget"]) ?? "note";
    const recommendation = normalizeRecommendationFeedback(meta.recommendation as RecommendationFeedback | null | undefined);

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
            recommendation,
          });

    const storedAudit = (meta.audit as Record<string, unknown> | undefined) ?? {};
    const storedHash = typeof storedAudit.hash === "string" ? storedAudit.hash : "";
    const storedPrevHash = typeof storedAudit.previousHash === "string" ? storedAudit.previousHash : null;
    const storedAuditId = typeof storedAudit.auditEventId === "string" ? storedAudit.auditEventId : null;
    const storedChainPosition = typeof storedAudit.chainPosition === "number" ? storedAudit.chainPosition : mapped.length + 1;

    const previousHash = mapped.at(-1)?.audit.hash ?? null;

    const computedHash = computeDecisionHash({
      tenantId: normalizedTenantId,
      jobId: jobIdFromMeta,
      candidateId: String(meta.candidateId ?? ""),
      decisionType,
      drivers,
      risks,
      tradeoff,
      confidenceScore,
      summary,
      recommendation,
      createdAt: entry.createdAt.toISOString(),
      createdBy: {
        id: String(createdBy.id ?? ""),
        email: createdBy.email ?? null,
        name: createdBy.name ?? null,
      },
      previousHash,
    });

    const governance = computeGovernanceSignals({
      drivers,
      risks,
      confidenceScore,
      summary,
      recommendation,
      overrideHistory: [...overrideHistory, recommendation?.alignment],
    });

    overrideHistory.push(recommendation?.alignment);

    const resolvedHash = storedHash || computedHash;
    const chainValid = (storedHash ? storedHash === computedHash : true) && storedPrevHash === previousHash;

    mapped.push({
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
      recommendation,
      createdAt: entry.createdAt.toISOString(),
      createdBy: {
        id: String(createdBy.id ?? ""),
        email: createdBy.email ?? null,
        name: createdBy.name ?? null,
      },
      bullhornNote: `${summary} Synced as ${bullhornTarget === "custom_field" ? "custom field payload" : "note"} for auditability.`,
      bullhornTarget,
      governance,
      audit: {
        auditEventId: storedAuditId,
        hash: resolvedHash,
        computedHash,
        previousHash,
        chainPosition: storedChainPosition,
        chainValid,
      },
    });
  }

  return mapped.reverse().filter((entry) => entry.jobId === jobId);
=======
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
<<<<<<< ours
      const recommendation = normalizeRecommendationFeedback(meta.recommendation as RecommendationFeedback | null | undefined);
      const tradeoffVocabulary = standardizeTradeoff(tradeoff);
      const standardizedTradeoff =
        typeof meta.standardizedTradeoff === "string" && meta.standardizedTradeoff.trim().length > 0 ? meta.standardizedTradeoff : tradeoffVocabulary?.label ?? null;
      const standardizedTradeoffKey =
        typeof meta.standardizedTradeoffKey === "string" && meta.standardizedTradeoffKey.trim().length > 0 ? meta.standardizedTradeoffKey : tradeoffVocabulary?.key ?? null;

      const normalizedRiskLabels =
        Array.isArray(meta.standardizedRisks) && meta.standardizedRisks.every((entry) => typeof entry === "string")
          ? (meta.standardizedRisks as string[])
          : standardizeRisks(risks).labels;
      const normalizedRiskKeys =
        Array.isArray(meta.standardizedRiskKeys) && meta.standardizedRiskKeys.every((entry) => typeof entry === "string")
          ? (meta.standardizedRiskKeys as string[])
          : standardizeRisks(risks).keys;

      const confidenceFrame =
        typeof meta.confidenceFrame === "string" && meta.confidenceFrame in CONFIDENCE_FRAMES
          ? (meta.confidenceFrame as keyof typeof CONFIDENCE_FRAMES)
          : frameConfidence(confidenceScore);
=======
      const archetype = describeAssignment((meta.archetype as ReqArchetypeAssignment | null | undefined) ?? null);
>>>>>>> theirs

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
<<<<<<< ours
              recommendation,
=======
              archetype,
>>>>>>> theirs
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
        recommendation,
        createdAt: entry.createdAt.toISOString(),
        createdBy: {
          id: String(createdBy.id ?? ""),
          email: createdBy.email ?? null,
          name: createdBy.name ?? null,
        },
        bullhornNote: `${summary} Synced as ${bullhornTarget === "custom_field" ? "custom field payload" : "note"} for auditability.`,
        bullhornTarget,
<<<<<<< ours
        standardizedTradeoff,
        standardizedTradeoffKey,
        standardizedRisks: normalizedRiskLabels,
        standardizedRiskKeys: normalizedRiskKeys,
        confidenceFrame,
=======
        archetype: archetype ?? null,
>>>>>>> theirs
      } satisfies DecisionReceiptRecord;
    })
    .filter((entry) => entry.jobId === jobId);
>>>>>>> theirs
}
