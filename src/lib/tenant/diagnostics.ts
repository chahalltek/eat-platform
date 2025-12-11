import { TenantDeletionMode, type SubscriptionPlan, type Tenant } from "@prisma/client";

import { getAppConfig } from "@/lib/config/configValidator";
import { FEATURE_FLAGS, type FeatureFlagName } from "@/lib/featureFlags/constants";
import { isFeatureEnabledForTenant } from "@/lib/featureFlags";
import { getRateLimitDefaults, getRateLimitPlanOverrides, type RateLimitConfig, type RateLimitPlanOverrides } from "@/lib/rateLimiting/rateLimiter";
import type { SystemMode } from "@/lib/systemMode";
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
  mode: SystemMode;
  fireDrill: { enabled: boolean; fireDrillImpact: string[] };
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

async function countAuditEvents(tenantId: string) {
  try {
    return await prisma.securityEventLog.count({ where: { tenantId } });
  } catch (error) {
    console.error("Unable to count audit events", error);
    return 0;
  }
}

function normalizeGuardrailsPreset(plan: Awaited<ReturnType<typeof getTenantPlan>> | null): GuardrailsPreset {
  const allowedPresets: Exclude<GuardrailsPreset, null>[] = ["conservative", "balanced", "aggressive", "custom"];
  const preset = (plan?.plan?.limits as { guardrailsPreset?: unknown } | null)?.guardrailsPreset;

  if (typeof preset !== "string") return null;

  const normalized = preset.toLowerCase();

  if (allowedPresets.includes(normalized as GuardrailsPreset)) {
    return normalized as GuardrailsPreset;
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
  const [config, plan, tenant, auditEventCount, flags, guardrails] = await Promise.all([
    getAppConfig(),
    getTenantPlan(tenantId),
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    countAuditEvents(tenantId),
    resolveEnabledFlags(tenantId),
    loadTenantGuardrailConfig(tenantId),
  ]);

  if (!tenant) {
    throw new TenantNotFoundError(tenantId);
  }

<<<<<<< ours
  const guardrailsPreset = normalizeGuardrailsPreset(plan);
=======
  const systemMode = getSystemMode(config);
>>>>>>> theirs

  return {
    tenantId,
    mode: systemMode.mode,
    fireDrill: systemMode.fireDrill,
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
