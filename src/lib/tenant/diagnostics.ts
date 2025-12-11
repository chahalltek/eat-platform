import { AgentRunStatus, TenantDeletionMode, type SubscriptionPlan, type Tenant } from "@prisma/client";

import { getAppConfig } from "@/lib/config/configValidator";
import { FEATURE_FLAGS, type FeatureFlagName } from "@/lib/featureFlags/constants";
import { isFeatureEnabledForTenant } from "@/lib/featureFlags";
import { getRateLimitDefaults, getRateLimitPlanOverrides, type RateLimitConfig, type RateLimitPlanOverrides } from "@/lib/rateLimiting/rateLimiter";
import type { SystemModeName } from "@/lib/systemMode";
import { getSystemMode } from "@/lib/systemMode";
import { getTenantPlan } from "@/lib/subscriptionPlans";
import { prisma } from "@/lib/prisma";
import { resolveRetentionPolicy } from "@/lib/retention";
import { loadTenantGuardrailConfig } from "@/lib/guardrails/config";

export class TenantNotFoundError extends Error {
  constructor(tenantId: string) {
    super(`Tenant ${tenantId} not found`);
    this.name = "TenantNotFoundError";
  }
}

export type GuardrailsPreset = "conservative" | "balanced" | "aggressive" | "custom" | null;

export type TenantDiagnostics = {
  tenantId: string;
  mode: SystemModeName;
  fireDrill: {
    enabled: boolean;
    fireDrillImpact: string[];
    suggested: boolean;
    reason: string | null;
    windowMinutes: number;
  };
  sso: { configured: boolean; issuerUrl: string | null };
  guardrailsPreset: GuardrailsPreset;
  guardrailsRecommendation: string | null;
  plan: {
    id: string | null;
    name: string | null;
    isTrial: boolean;
    trialEndsAt: string | null;
    limits: unknown;
  };
  auditLogging: { enabled: boolean; eventsRecorded: number };
  dataExport: { enabled: boolean };
  retention: { configured: boolean; days: number | null; mode: TenantDeletionMode | null };
  rateLimits: Array<{
    action: string;
    default: RateLimitConfig;
    override: RateLimitPlanOverrides | null;
  }>;
  featureFlags: { enabled: boolean; enabledFlags: FeatureFlagName[] };
  guardrails: {
    source: string;
    matcherMinScore: number;
    shortlistMinScore: number;
    shortlistMaxCandidates: number;
    requireMustHaveSkills: boolean;
    explainLevel: string;
    confidencePassingScore: number;
  };
};

function isSsoConfigured(config: ReturnType<typeof getAppConfig>) {
  return Boolean(config.SSO_ISSUER_URL && config.SSO_CLIENT_ID && config.SSO_CLIENT_SECRET);
}

function mapPlan(plan: Awaited<ReturnType<typeof getTenantPlan>> | null) {
  if (!plan) {
    return { id: null, name: null, isTrial: false, trialEndsAt: null, limits: null };
  }

  return {
    id: plan.plan.id,
    name: plan.plan.name,
    isTrial: plan.subscription.isTrial,
    trialEndsAt: plan.subscription.endAt ? plan.subscription.endAt.toISOString() : null,
    limits: plan.plan.limits,
  } as const;
}

function mapRetention(tenant: Pick<Tenant, "id" | "dataRetentionDays" | "deletionMode"> | null) {
  if (!tenant) {
    return { configured: false, days: null, mode: null } as const;
  }

  const policy = resolveRetentionPolicy({
    id: tenant.id,
    dataRetentionDays: tenant.dataRetentionDays ?? null,
    deletionMode: tenant.deletionMode ?? TenantDeletionMode.SOFT_DELETE,
  });

  return {
    configured: Boolean(policy),
    days: policy?.cutoff ? (tenant.dataRetentionDays as number) : null,
    mode: policy?.mode ?? null,
  } as const;
}

function mapRateLimits(plan: SubscriptionPlan | null) {
  const defaults = getRateLimitDefaults();
  const overrides = getRateLimitPlanOverrides(plan);

  return Object.entries(defaults).map(([action, config]) => ({
    action,
    default: config,
    override: overrides?.[action as keyof typeof overrides] ?? null,
  }));
}

async function resolveEnabledFlags(tenantId: string) {
  const enabledFlags: FeatureFlagName[] = [];

  for (const name of Object.values(FEATURE_FLAGS) as FeatureFlagName[]) {
    if (await isFeatureEnabledForTenant(tenantId, name)) {
      enabledFlags.push(name);
    }
  }

  return {
    enabledFlags,
    enabled: enabledFlags.length > 0,
  } as const;
}

const INCIDENT_WINDOW_MINUTES = 30;
const EXPLAIN_FAILURE_THRESHOLD = 0.3;
const LLM_FAILURE_THRESHOLD = 0.25;
const MATCH_FAILURE_THRESHOLD = 0.25;
const FIRE_DRILL_IMPACT = ["Agent dispatch paused", "Guardrails forced to conservative"] as const;

async function evaluateFireDrillStatus(tenantId: string) {
  const since = new Date(Date.now() - INCIDENT_WINDOW_MINUTES * 60 * 1000);

  const [
    explainTotal,
    explainFailures,
    llmTotal,
    llmFailures,
    matchTotal,
    matchFailures,
    fireDrillEnabled,
  ] = await Promise.all([
    prisma.agentRunLog.count({
      where: { tenantId, agentName: { contains: "EXPLAIN", mode: "insensitive" }, startedAt: { gte: since } },
    }),
    prisma.agentRunLog.count({
      where: {
        tenantId,
        agentName: { contains: "EXPLAIN", mode: "insensitive" },
        status: AgentRunStatus.FAILED,
        startedAt: { gte: since },
      },
    }),
    prisma.agentRunLog.count({
      where: {
        tenantId,
        OR: [
          { agentName: { contains: "RINA", mode: "insensitive" } },
          { agentName: { contains: "RUA", mode: "insensitive" } },
        ],
        startedAt: { gte: since },
      },
    }),
    prisma.agentRunLog.count({
      where: {
        tenantId,
        OR: [
          { agentName: { contains: "RINA", mode: "insensitive" } },
          { agentName: { contains: "RUA", mode: "insensitive" } },
        ],
        status: AgentRunStatus.FAILED,
        startedAt: { gte: since },
      },
    }),
    prisma.agentRunLog.count({
      where: {
        tenantId,
        OR: [
          { agentName: { contains: "MATCH", mode: "insensitive" } },
          { agentName: { contains: "CONFIDENCE", mode: "insensitive" } },
          { agentName: { contains: "RANK", mode: "insensitive" } },
        ],
        startedAt: { gte: since },
      },
    }),
    prisma.agentRunLog.count({
      where: {
        tenantId,
        OR: [
          { agentName: { contains: "MATCH", mode: "insensitive" } },
          { agentName: { contains: "CONFIDENCE", mode: "insensitive" } },
          { agentName: { contains: "RANK", mode: "insensitive" } },
        ],
        status: AgentRunStatus.FAILED,
        startedAt: { gte: since },
      },
    }),
    isFeatureEnabledForTenant(tenantId, FEATURE_FLAGS.FIRE_DRILL_MODE),
  ]);

  const reasons: string[] = [];

  if (explainTotal > 0 && explainFailures / explainTotal > EXPLAIN_FAILURE_THRESHOLD) {
    reasons.push("elevated EXPLAIN errors were observed");
  }

  if (llmTotal > 0 && llmFailures / llmTotal > LLM_FAILURE_THRESHOLD) {
    reasons.push("LLM producer failures exceeded thresholds");
  }

  if (matchTotal > 0 && matchFailures / matchTotal > MATCH_FAILURE_THRESHOLD) {
    reasons.push("MATCH or CONFIDENCE failures exceeded thresholds");
  }

  const suggested = !fireDrillEnabled && reasons.length > 0;

  return {
    enabled: fireDrillEnabled,
    fireDrillImpact: fireDrillEnabled ? [...FIRE_DRILL_IMPACT] : [],
    suggested,
    windowMinutes: INCIDENT_WINDOW_MINUTES,
    reason: suggested ? `Consider enabling Fire Drill mode: ${reasons[0]}.` : null,
  } as const;
}

async function countAuditEvents(tenantId: string) {
  try {
    return await prisma.securityEventLog.count({ where: { tenantId } });
  } catch (error) {
    console.error("Unable to count audit events", error);
    return 0;
  }
}

function normalizeGuardrailsPreset(plan: Awaited<ReturnType<typeof getTenantPlan>> | null): GuardrailsPreset {
  const allowedPresets: Array<Exclude<GuardrailsPreset, null>> = [
    "conservative",
    "balanced",
    "aggressive",
    "custom",
  ];
  const preset = (plan?.plan?.limits as { guardrailsPreset?: unknown } | null)?.guardrailsPreset;

  if (typeof preset !== "string") return null;

  const normalized = preset.toLowerCase();

  const matchedPreset = allowedPresets.find((value) => value === normalized);

  if (matchedPreset) {
    return matchedPreset;
  }

  return "custom";
}

function buildGuardrailsRecommendation(preset: GuardrailsPreset) {
  if (!preset) {
    return "Consider using a preset (balanced) to simplify tuning.";
  }

  if (preset === "custom") {
    return 'Use a preset and treat "custom" as explicit overrides.';
  }

  return "Guardrails customized from default values.";
}

export async function buildTenantDiagnostics(tenantId: string): Promise<TenantDiagnostics> {
  const [config, plan, tenant, auditEventCount, flags, guardrails, fireDrill] = await Promise.all([
    getAppConfig(),
    getTenantPlan(tenantId),
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    countAuditEvents(tenantId),
    resolveEnabledFlags(tenantId),
    loadTenantGuardrailConfig(tenantId),
    evaluateFireDrillStatus(tenantId),
  ]);

  if (!tenant) {
    throw new TenantNotFoundError(tenantId);
  }

  const systemMode = await getSystemMode(tenantId);
  const guardrailsPreset = normalizeGuardrailsPreset(plan);

  return {
    tenantId,
    mode: systemMode.mode,
    fireDrill: {
      fireDrillImpact: fireDrill.fireDrillImpact ?? [],
      ...fireDrill,
    },
    sso: { configured: isSsoConfigured(config), issuerUrl: config.SSO_ISSUER_URL ?? null },
    guardrailsPreset,
    guardrailsRecommendation: buildGuardrailsRecommendation(guardrailsPreset),
    plan: mapPlan(plan),
    auditLogging: { enabled: auditEventCount > 0, eventsRecorded: auditEventCount },
    dataExport: { enabled: true },
    retention: mapRetention(tenant),
    rateLimits: mapRateLimits(plan?.plan ?? null),
    featureFlags: flags,
    guardrails: {
      source: guardrails.source,
      matcherMinScore: guardrails.matcherMinScore,
      shortlistMinScore: guardrails.shortlistMinScore,
      shortlistMaxCandidates: guardrails.shortlistMaxCandidates,
      requireMustHaveSkills: guardrails.requireMustHaveSkills,
      explainLevel: guardrails.explainLevel,
      confidencePassingScore: guardrails.confidencePassingScore,
    },
  } satisfies TenantDiagnostics;
}
