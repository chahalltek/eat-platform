import { type PipelineStep } from "@/lib/orchestration/pipelineRunner";
import { type SystemModeName } from "@/lib/modes/systemModes";

export type OrchestrationPolicy = {
  when: "job_updated" | "candidate_ingested" | "manual";
  steps: PipelineStep[];
  conditions?: {
    minCandidates?: number;
    mode?: SystemModeName;
  };
};

const POLICY_ENV_KEY = "ORCHESTRATION_POLICIES";

export const DEFAULT_ORCHESTRATION_POLICIES: OrchestrationPolicy[] = [
  {
    when: "job_updated",
    steps: ["MATCH", "CONFIDENCE"],
  },
  {
    when: "candidate_ingested",
    steps: ["MATCH"],
    conditions: { minCandidates: 1 },
  },
  {
    when: "manual",
    steps: ["MATCH", "CONFIDENCE", "EXPLAIN", "SHORTLIST"],
  },
];

type TenantPolicyConfig = Record<string, OrchestrationPolicy[]>;

function isPolicy(value: unknown): value is OrchestrationPolicy {
  if (!value || typeof value !== "object") return false;

  const candidate = value as OrchestrationPolicy;

  return (
    candidate.when === "job_updated" ||
    candidate.when === "candidate_ingested" ||
    candidate.when === "manual"
  );
}

function normalizePolicies(policies: unknown): OrchestrationPolicy[] {
  if (!Array.isArray(policies)) return [];

  return policies.filter(isPolicy);
}

export function parsePolicyConfig(rawConfig?: string | null): TenantPolicyConfig {
  if (!rawConfig) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawConfig) as unknown;

    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([tenantId, policies]) => [
        tenantId,
        normalizePolicies(policies),
      ]),
    );
  } catch (error) {
    console.warn(`Failed to parse ${POLICY_ENV_KEY}`, error);
    return {};
  }
}

export function getTenantPolicies(tenantId: string, rawConfig = process.env[POLICY_ENV_KEY]): OrchestrationPolicy[] {
  const config = parsePolicyConfig(rawConfig);

  return config[tenantId] ?? config["*"] ?? DEFAULT_ORCHESTRATION_POLICIES;
}

export type PolicyEvaluationContext = {
  event: OrchestrationPolicy["when"];
  tenantMode: SystemModeName;
  candidateCount: number;
};

export function selectApplicablePolicies(
  policies: OrchestrationPolicy[],
  context: PolicyEvaluationContext,
): OrchestrationPolicy[] {
  return policies.filter((policy) => {
    if (policy.when !== context.event) {
      return false;
    }

    if (context.tenantMode === "fire_drill" && policy.when !== "manual" && policy.conditions?.mode !== "fire_drill") {
      return false;
    }

    if (policy.conditions?.mode && policy.conditions.mode !== context.tenantMode) {
      return false;
    }

    if (typeof policy.conditions?.minCandidates === "number") {
      return context.candidateCount >= policy.conditions.minCandidates;
    }

    return true;
  });
}
