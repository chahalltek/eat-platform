import { AgentRunStatus, Prisma, TenantDeletionMode, type SubscriptionPlan, type Tenant } from "@/server/db/prisma";

import { getAppConfig } from "@/lib/config/configValidator";
import { FEATURE_FLAGS, type FeatureFlagName } from "@/lib/featureFlags/constants";
import { isFeatureEnabledForTenant } from "@/lib/featureFlags";
import { getRateLimitDefaults, getRateLimitPlanOverrides, type RateLimitConfig, type RateLimitPlanOverrides } from "@/lib/rateLimiting/rateLimiter";
import type { SystemModeName } from "@/lib/modes/systemModes";
import { getTenantPlan } from "@/lib/subscriptionPlans";
import { prisma } from "@/server/db/prisma";
import { resolveRetentionPolicy } from "@/lib/retention";
import { DEFAULT_GUARDRAILS, loadTenantGuardrailConfig } from "@/lib/guardrails/config";
import {
  defaultTenantGuardrails,
  loadTenantGuardrailsWithSchemaStatus,
  type TenantGuardrails,
} from "@/lib/tenant/guardrails";
import { loadTenantMode } from "@/lib/modes/loadTenantMode";
import { getAzureOpenAIApiKey, getOpenAIApiKey } from "@/server/config/secrets";

export class TenantNotFoundError extends Error {
  constructor(tenantId: string) {
    super(`Tenant ${tenantId} not found`);
    this.name = "TenantNotFoundError";
  }
}

export type GuardrailsPreset = "conservative" | "balanced" | "aggressive" | "demo-safe" | "custom" | null;

export type TenantDiagnostics = {
  tenantId: string;
  mode: SystemModeName;
  modeNotice: string | null;
  fireDrill: {
    enabled: boolean;
    fireDrillImpact: string[];
    suggested: boolean;
    reason: string | null;
    windowMinutes: number;
  };
  sso: { configured: boolean; issuerUrl: string | null };
  guardrailsPreset: GuardrailsPreset;
  guardrailsStatus: string;
  guardrailsRecommendation: string | null;
  configSchema: {
    status: "ok" | "fallback";
    missingColumns: string[];
    reason: string | null;
  };
  schemaDrift: {
    status: "ok" | "fault";
    missingColumns: string[];
    reason: string | null;
  };
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
  llm: {
    provider: string;
    model: string;
    allowedAgents: string[];
    status: "ready" | "disabled" | "blocked" | "fire_drill";
    reason: string | null;
    maxTokens: number | null;
    verbosityCap: number | null;
    fireDrillOverride: boolean;
  };
  ats: {
    provider: string;
    status: "success" | "failed" | "running" | "unknown";
    lastRunAt: string | null;
    nextAttemptAt: string | null;
    errorMessage: string | null;
    retryCount: number;
    summary: {
      jobsSynced: number;
      candidatesSynced: number;
      placementsSynced: number;
    } | null;
  };
};

function isSsoConfigured(config: ReturnType<typeof getAppConfig>) {
  return Boolean(config.SSO_ISSUER_URL && config.SSO_CLIENT_ID && config.SSO_CLIENT_SECRET);
}

function mapPlan(plan: Awaited<ReturnType<typeof getTenantPlan>> | null) {
  if (!plan?.plan) {
    return { id: null, name: null, isTrial: false, trialEndsAt: null, limits: null };
  }

  const subscription = plan.subscription ?? { isTrial: false, endAt: null };

  return {
    id: plan.plan.id,
    name: plan.plan.name,
    isTrial: subscription.isTrial ?? false,
    trialEndsAt: subscription.endAt ? subscription.endAt.toISOString() : null,
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

function isLlmProviderReady(llm: TenantGuardrails["llm"]) {
  if (llm.provider === "openai") {
    return Boolean(getOpenAIApiKey());
  }

  if (llm.provider === "azure-openai") {
    return Boolean(getAzureOpenAIApiKey() ?? getOpenAIApiKey());
  }

  return false;
}

function mapLlmDiagnostics(llm: TenantGuardrails["llm"], fireDrillEnabled: boolean) {
  const providerReady = isLlmProviderReady(llm);

  if (fireDrillEnabled) {
    return {
      provider: llm.provider,
      model: llm.model,
      allowedAgents: llm.allowedAgents,
      status: "fire_drill" as const,
      reason: "Fire Drill mode disables LLM access.",
      maxTokens: llm.maxTokens ?? null,
      verbosityCap: llm.verbosityCap ?? null,
      fireDrillOverride: true,
    };
  }

  if (llm.provider === "disabled") {
    return {
      provider: llm.provider,
      model: llm.model,
      allowedAgents: llm.allowedAgents,
      status: "disabled" as const,
      reason: "Provider disabled for this tenant.",
      maxTokens: llm.maxTokens ?? null,
      verbosityCap: llm.verbosityCap ?? null,
      fireDrillOverride: false,
    };
  }

  if (!providerReady) {
    return {
      provider: llm.provider,
      model: llm.model,
      allowedAgents: llm.allowedAgents,
      status: "blocked" as const,
      reason: "Provider credentials are missing or unavailable.",
      maxTokens: llm.maxTokens ?? null,
      verbosityCap: llm.verbosityCap ?? null,
      fireDrillOverride: false,
    };
  }

  return {
    provider: llm.provider,
    model: llm.model,
    allowedAgents: llm.allowedAgents,
    status: "ready" as const,
    reason: null,
    maxTokens: llm.maxTokens ?? null,
    verbosityCap: llm.verbosityCap ?? null,
    fireDrillOverride: false,
  };
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

type SyncSummary = TenantDiagnostics["ats"]["summary"];

function parseSyncSummary(output: unknown): SyncSummary {
  if (!output || typeof output !== "object") return null;

  const candidate = output as Record<string, unknown>;
  const jobsSynced = Number(candidate.jobsSynced);
  const candidatesSynced = Number(candidate.candidatesSynced);
  const placementsSynced = Number(candidate.placementsSynced);

  if ([jobsSynced, candidatesSynced, placementsSynced].some((value) => Number.isNaN(value))) {
    return null;
  }

  return { jobsSynced, candidatesSynced, placementsSynced };
}

function parseRetryPayload(value: unknown): { nextAttemptAt: string | null } {
  if (!value || typeof value !== "object") return { nextAttemptAt: null };

  const payload = value as { nextAttemptAt?: unknown };
  const nextAttemptAt =
    typeof payload.nextAttemptAt === "string" && payload.nextAttemptAt ? payload.nextAttemptAt : null;

  return { nextAttemptAt };
}

export async function loadLatestAtsSync(tenantId: string): Promise<TenantDiagnostics["ats"]> {
  try {
    const lastSync = await prisma.agentRunLog.findFirst({
      where: { tenantId, agentName: { contains: "ATS_SYNC", mode: "insensitive" } },
      orderBy: { startedAt: "desc" },
    });

    if (!lastSync) {
      return {
        provider: "bullhorn",
        status: "unknown",
        lastRunAt: null,
        nextAttemptAt: null,
        errorMessage: null,
        retryCount: 0,
        summary: null,
      } as const;
    }

    const status =
      lastSync.status === AGENT_RUN_STATUS.SUCCESS
        ? "success"
        : lastSync.status === AGENT_RUN_STATUS.RUNNING
          ? "running"
          : "failed";

    const nextAttemptAt = parseRetryPayload(lastSync.retryPayload).nextAttemptAt;
    const provider = lastSync.agentName?.split?.(".")?.[1]?.toLowerCase?.() ?? "bullhorn";

    return {
      provider,
      status,
      lastRunAt: (lastSync.finishedAt ?? lastSync.startedAt)?.toISOString() ?? null,
      nextAttemptAt,
      errorMessage: lastSync.errorMessage ?? null,
      retryCount: lastSync.retryCount ?? 0,
      summary: parseSyncSummary(lastSync.outputSnapshot),
    } as const;
  } catch (error) {
    console.error("Unable to load ATS sync diagnostics", error);
    return {
      provider: "bullhorn",
      status: "unknown",
      lastRunAt: null,
      nextAttemptAt: null,
      errorMessage: "Unable to load ATS sync diagnostics",
      retryCount: 0,
      summary: null,
    } as const;
  }
}

async function resolveEnabledFlags(tenantId: string): Promise<TenantDiagnostics["featureFlags"]> {
  try {
    const enabledFlags: FeatureFlagName[] = [];

    for (const name of Object.values(FEATURE_FLAGS) as FeatureFlagName[]) {
      if (await isFeatureEnabledForTenant(tenantId, name)) {
        enabledFlags.push(name);
      }
    }

    return {
      enabledFlags,
      enabled: enabledFlags.length > 0,
    };
  } catch (error) {
    console.error("Unable to resolve feature flags", error);
    return { enabled: false, enabledFlags: [] };
  }
}

const INCIDENT_WINDOW_MINUTES = 30;
const EXPLAIN_FAILURE_THRESHOLD = 0.3;
const LLM_FAILURE_THRESHOLD = 0.25;
const MATCH_FAILURE_THRESHOLD = 0.25;
const FIRE_DRILL_IMPACT = ["Agent dispatch paused", "Guardrails forced to conservative"] as const;
const TENANT_CONFIG_EXPECTED_COLUMNS = ["preset", "llm", "networkLearningOptIn", "networkLearning"] as const;

const AGENT_RUN_STATUS =
  AgentRunStatus ??
  (Prisma as { AgentRunStatus?: typeof AgentRunStatus } | undefined)?.AgentRunStatus ?? {
    RUNNING: "RUNNING",
    SUCCESS: "SUCCESS",
    FAILED: "FAILED",
    PARTIAL: "PARTIAL",
  };

async function evaluateFireDrillStatus(tenantId: string): Promise<TenantDiagnostics["fireDrill"]> {
  const since = new Date(Date.now() - INCIDENT_WINDOW_MINUTES * 60 * 1000);

  try {
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
          status: AGENT_RUN_STATUS.FAILED,
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
          status: AGENT_RUN_STATUS.FAILED,
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
          status: AGENT_RUN_STATUS.FAILED,
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
    };
  } catch (error) {
    console.error("Unable to evaluate Fire Drill status", error);
    return {
      enabled: false,
      fireDrillImpact: [],
      suggested: false,
      windowMinutes: INCIDENT_WINDOW_MINUTES,
      reason: null,
    };
  }
}

async function evaluateTenantConfigSchemaDrift(): Promise<TenantDiagnostics["schemaDrift"]> {
  try {
    const columns = await prisma.$queryRaw<Array<{ column_name?: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'TenantConfig'
    `;

    const presentColumns = columns
      .map((column) => column.column_name?.toLowerCase?.())
      .filter((value): value is string => Boolean(value));

    const missingColumns = TENANT_CONFIG_EXPECTED_COLUMNS.filter(
      (name) => !presentColumns.includes(name.toLowerCase()),
    );

    if (missingColumns.length === 0) {
      return { status: "ok", missingColumns, reason: null };
    }

    return {
      status: "fault",
      missingColumns,
      reason: `Missing columns: ${missingColumns.join(", ")}`,
    };
  } catch (error) {
    console.error("Unable to evaluate TenantConfig schema drift", error);
    return {
      status: "fault",
      missingColumns: [...TENANT_CONFIG_EXPECTED_COLUMNS],
      reason: "TenantConfig schema could not be inspected; check recent migrations.",
    };
  }
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

function buildGuardrailsStatus(guardrails: TenantDiagnostics["guardrails"], fireDrill: TenantDiagnostics["fireDrill"]) {
  if (fireDrill.enabled) {
    return "EXPLAIN & CONFIDENCE are restricted";
  }

  const missingCriticalSettings =
    guardrails.matcherMinScore <= 0 ||
    guardrails.shortlistMinScore <= 0 ||
    guardrails.shortlistMaxCandidates <= 0 ||
    guardrails.confidencePassingScore <= 0;

  if (missingCriticalSettings) {
    return "Guardrails partially configured";
  }

  return "Guardrails healthy";
}

export async function buildTenantDiagnostics(tenantId: string): Promise<TenantDiagnostics> {
  const [
    config,
    plan,
    tenant,
    auditEventCount,
    flags,
    guardrails,
    fireDrill,
    tenantMode,
    tenantGuardrailsResult,
    atsSync,
    schemaDrift,
  ] = await Promise.all([
    Promise.resolve()
      .then(() => getAppConfig())
      .catch(() => ({} as ReturnType<typeof getAppConfig>)),
    Promise.resolve()
      .then(() => getTenantPlan(tenantId))
      .catch((error) => {
      console.error("Unable to load tenant plan", error);
      return null;
    }),
    prisma.tenant.findUnique({ where: { id: tenantId }, include: { config: true } }),
    countAuditEvents(tenantId),
    resolveEnabledFlags(tenantId),
    loadTenantGuardrailConfig(tenantId).catch((error) => {
      console.error("Unable to load guardrail config", error);
      return DEFAULT_GUARDRAILS;
    }),
    evaluateFireDrillStatus(tenantId),
    loadTenantMode(tenantId),
    loadTenantGuardrailsWithSchemaStatus(tenantId).catch((error) => {
      console.error("Unable to load tenant guardrails", error);
      return { guardrails: defaultTenantGuardrails, schemaStatus: { status: "fallback", missingColumns: [], reason: null } };
    }),
    loadLatestAtsSync(tenantId),
    evaluateTenantConfigSchemaDrift(),
  ]);

  if (!tenant) {
    throw new TenantNotFoundError(tenantId);
  }

  const configRecord = Array.isArray(tenant?.config) ? tenant?.config?.[0] : tenant?.config;
  const guardrailsPreset = (configRecord?.preset as GuardrailsPreset | null) ?? normalizeGuardrailsPreset(plan) ?? "custom";

  const configuredMode = (configRecord as { mode?: string | null } | null)?.mode ?? null;
  const modeNotice = configuredMode ? null : tenantMode.source === "fallback" ? "Mode not found; defaulting to diagnostics." : null;
  const mode = (configuredMode as SystemModeName | null) ?? tenantMode.mode;

  const fireDrillImpact = fireDrill?.fireDrillImpact ?? [];
  const guardrailsStatus = buildGuardrailsStatus(guardrails, fireDrill);

  const configSchema = tenantGuardrailsResult.schemaStatus.status === "fallback"
    ? {
        status: "fallback" as const,
        missingColumns: [...tenantGuardrailsResult.schemaStatus.missingColumns],
        reason:
          tenantGuardrailsResult.schemaStatus.reason ??
          (tenantGuardrailsResult.schemaStatus.missingColumns.length > 0
            ? `Missing columns: ${tenantGuardrailsResult.schemaStatus.missingColumns.join(", ")}`
            : "Config schema out of date; guardrails defaults are being used."),
      }
    : { status: "ok" as const, missingColumns: [] as string[], reason: null };

  const tenantGuardrails = tenantGuardrailsResult.guardrails;

  return {
    tenantId,
    mode,
    modeNotice,
    fireDrill: {
      ...fireDrill,
      fireDrillImpact,
    },
    sso: { configured: isSsoConfigured(config), issuerUrl: config.SSO_ISSUER_URL ?? null },
    guardrailsPreset,
    guardrailsStatus,
    guardrailsRecommendation: buildGuardrailsRecommendation(guardrailsPreset),
    configSchema,
    schemaDrift,
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
    llm: mapLlmDiagnostics(tenantGuardrails.llm, fireDrill.enabled),
    ats: atsSync,
  } satisfies TenantDiagnostics;
}
