import { isFeatureEnabledForTenant } from "@/lib/featureFlags";
import { FEATURE_FLAGS } from "@/lib/featureFlags/constants";
import { loadTenantGuardrails, type TenantGuardrails } from "@/lib/tenant/guardrails";
import { getCurrentTenantId } from "@/lib/tenant";

export class LLMUsageRestrictedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMUsageRestrictedError";
  }
}

export type TenantLLMControls = TenantGuardrails["llm"] & { providerReady: boolean };

function isProviderReady(provider: TenantGuardrails["llm"]["provider"]): boolean {
  if (provider === "openai") {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  if (provider === "azure-openai") {
    return Boolean(process.env.AZURE_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY);
  }

  return false;
}

export async function assertLlmUsageAllowed({
  tenantId,
  agent,
}: {
  tenantId?: string;
  agent: string;
}): Promise<TenantLLMControls> {
  const resolvedTenantId = tenantId ?? (await getCurrentTenantId());
  const guardrails = await loadTenantGuardrails(resolvedTenantId);
  const fireDrillEnabled = await isFeatureEnabledForTenant(resolvedTenantId, FEATURE_FLAGS.FIRE_DRILL_MODE);

  if (fireDrillEnabled) {
    throw new LLMUsageRestrictedError("LLM usage is blocked by Fire Drill mode.");
  }

  if (guardrails.llm.provider === "disabled") {
    throw new LLMUsageRestrictedError("LLM provider disabled for this tenant.");
  }

  const allowedAgents = guardrails.llm.allowedAgents.map((entry) => entry.toUpperCase());
  if (!allowedAgents.includes(agent.toUpperCase())) {
    throw new LLMUsageRestrictedError("This agent is not authorized to call LLMs for this tenant.");
  }

  const providerReady = isProviderReady(guardrails.llm.provider);

  if (!providerReady) {
    throw new LLMUsageRestrictedError("LLM provider credentials are missing or unavailable.");
  }

  return { ...guardrails.llm, providerReady } satisfies TenantLLMControls;
}
