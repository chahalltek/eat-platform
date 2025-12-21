import type { MetricEvent } from "@prisma/client";

import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { prisma } from "@/server/db/prisma";

import type { DecisionReceiptInput } from "./decisionReceipts";

export type DecisionArtifactStatus = "draft" | "published";

export type DecisionArtifact = {
  id: string;
  status: DecisionArtifactStatus;
  decisionType: DecisionReceiptInput["decisionType"] | "UNKNOWN";
  jobId: string;
  jobTitle: string | null;
  candidateId: string;
  candidateName: string;
  summary: string;
  tradeoff: string | null;
  standardizedTradeoff: string | null;
  drivers: string[];
  risks: string[];
  standardizedRisks: string[];
  createdAt: string;
  createdBy: { id: string | null; name: string | null; email: string | null };
  visibility: "creator" | "tenant";
};

function normalizeStatus(value: unknown): DecisionArtifactStatus {
  return typeof value === "string" && value.toLowerCase() === "draft" ? "draft" : "published";
}

function normalizeDecisionType(value: unknown): DecisionReceiptInput["decisionType"] | "UNKNOWN" {
  const allowed: DecisionReceiptInput["decisionType"][] = ["RECOMMEND", "SUBMIT", "REJECT", "PASS"];
  return typeof value === "string" && allowed.includes(value as DecisionReceiptInput["decisionType"])
    ? (value as DecisionReceiptInput["decisionType"])
    : "UNKNOWN";
}

function asString(value: unknown, fallback: string | null = ""): string | null {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown, limit = 6): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean)
    .slice(0, limit);
}

function parseCreatedBy(value: unknown): DecisionArtifact["createdBy"] {
  const createdBy = (value as Record<string, unknown> | undefined) ?? {};
  return {
    id: asString(createdBy.id) ?? null,
    name: asString(createdBy.name) ?? null,
    email: asString(createdBy.email) ?? null,
  };
}

function isDraftVisibleToUser(artifact: DecisionArtifact, userId?: string | null) {
  if (artifact.status !== "draft") return true;
  if (!userId) return false;
  return artifact.createdBy.id === userId;
}

function matchesSearch(artifact: DecisionArtifact, search: string) {
  if (!search.trim()) return true;
  const normalized = search.trim().toLowerCase();
  const haystack = [
    artifact.summary,
    artifact.candidateName,
    artifact.candidateId,
    artifact.jobId,
    artifact.jobTitle ?? "",
    artifact.decisionType,
    artifact.tradeoff ?? "",
    ...artifact.drivers,
    ...artifact.risks,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}

function mapEventToArtifact(
  event: Pick<MetricEvent, "id" | "entityId" | "createdAt" | "meta">,
  jobTitles: Record<string, string | undefined>,
): DecisionArtifact {
  const meta = (event.meta ?? {}) as Record<string, unknown>;

  const jobId = asString(meta.jobId, event.entityId ?? "") ?? "";
  const candidateId = asString(meta.candidateId, "") ?? "";
  const candidateName = asString(meta.candidateName, "Unknown candidate") ?? "Unknown candidate";
  const summary = asString(meta.summary, "Decision captured for auditing.") ?? "Decision captured for auditing.";
  const tradeoff = asString(meta.tradeoff, null);
  const standardizedTradeoff = asString(meta.standardizedTradeoff, null);

  const drivers = asStringArray(meta.drivers, 3);
  const risks = asStringArray(meta.risks, 4);
  const standardizedRisks = asStringArray(meta.standardizedRisks, 4);

  const status = normalizeStatus(meta.status);
  const createdBy = parseCreatedBy(meta.createdBy);

  return {
    id: event.id,
    status,
    decisionType: normalizeDecisionType(meta.decisionType),
    jobId,
    jobTitle: jobTitles[jobId] ?? null,
    candidateId,
    candidateName,
    summary,
    tradeoff,
    standardizedTradeoff,
    drivers,
    risks,
    standardizedRisks,
    createdAt: event.createdAt.toISOString(),
    createdBy,
    visibility: status === "draft" ? "creator" : "tenant",
  };
}

async function resolveJobTitles(tenantId: string, jobIds: string[]) {
  if (!jobIds.length) return {};

  const jobs = await prisma.jobReq.findMany({
    where: { tenantId, id: { in: jobIds } },
    select: { id: true, title: true },
  });

  return Object.fromEntries(jobs.map((job) => [job.id, job.title])) as Record<string, string>;
}

export async function listDecisionArtifacts({
  tenantId,
  userId,
  status,
  search,
  take = 200,
}: {
  tenantId?: string | null;
  userId?: string | null;
  status?: DecisionArtifactStatus;
  search?: string | null;
  take?: number;
}): Promise<DecisionArtifact[]> {
  const normalizedTenantId = (tenantId ?? DEFAULT_TENANT_ID).trim();
  const events = await prisma.metricEvent.findMany({
    where: {
      tenantId: normalizedTenantId,
      eventType: "DECISION_RECEIPT_CREATED",
    },
    orderBy: { createdAt: "desc" },
    take,
  });

  const jobIds = Array.from(
    new Set(
      events
        .map((event) => {
          const meta = (event.meta ?? {}) as Record<string, unknown>;
          return asString(meta.jobId, event.entityId ?? "") ?? "";
        })
        .filter(Boolean),
    ),
  );
  const jobTitles = await resolveJobTitles(normalizedTenantId, jobIds);

  const artifacts = events.map((event) => mapEventToArtifact(event, jobTitles));

  return artifacts.filter((artifact) => {
    if (!isDraftVisibleToUser(artifact, userId)) return false;
    if (status && artifact.status !== status) return false;
    if (search && !matchesSearch(artifact, search)) return false;
    return true;
  });
}

export async function getDecisionArtifact(
  id: string,
  { tenantId, userId }: { tenantId?: string | null; userId?: string | null },
): Promise<DecisionArtifact | null> {
  const normalizedTenantId = (tenantId ?? DEFAULT_TENANT_ID).trim();
  const event = await prisma.metricEvent.findFirst({
    where: { id, tenantId: normalizedTenantId, eventType: "DECISION_RECEIPT_CREATED" },
  });

  if (!event) return null;

  const meta = (event.meta ?? {}) as Record<string, unknown>;
  const jobId = asString(meta.jobId, event.entityId ?? "") ?? "";
  const jobTitles = await resolveJobTitles(normalizedTenantId, jobId ? [jobId] : []);
  const artifact = mapEventToArtifact(event, jobTitles);

  if (!isDraftVisibleToUser(artifact, userId)) return null;

  return artifact;
}
