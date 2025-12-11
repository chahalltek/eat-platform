import { TS_CONFIG } from "@/config/ts";
import { prisma } from "@/lib/prisma";

export type GuardrailConfig = {
  matcherMinScore: number;
  shortlistMinScore: number;
  shortlistMaxCandidates: number;
  requireMustHaveSkills: boolean;
  explainLevel: "compact" | "detailed";
  confidencePassingScore: number;
  source: "default" | "database";
};

export type GuardrailConfigRecord = Partial<GuardrailConfig> & { tenantId?: string };

export const DEFAULT_GUARDRAILS: GuardrailConfig = {
  matcherMinScore: TS_CONFIG.matcher.minScore,
  shortlistMinScore: TS_CONFIG.shortlist.minMatchScore,
  shortlistMaxCandidates: TS_CONFIG.shortlist.topN,
  requireMustHaveSkills: false,
  explainLevel: "detailed",
  confidencePassingScore: TS_CONFIG.confidence.passingScore,
  source: "default",
};

type PrismaGuardrailClient = { guardrailConfig?: { findUnique: (args: unknown) => Promise<GuardrailConfigRecord | null> } };

export async function loadTenantGuardrailConfig(
  tenantId: string,
  client: PrismaGuardrailClient = prisma as unknown as PrismaGuardrailClient,
): Promise<GuardrailConfig> {
  try {
    const record = await client.guardrailConfig?.findUnique?.({
      where: { tenantId },
    });

    if (!record) {
      return { ...DEFAULT_GUARDRAILS, source: "default" };
    }

    const merged = { ...DEFAULT_GUARDRAILS, ...record, source: "database" };
    delete (merged as Partial<GuardrailConfigRecord>).tenantId;

    return merged;
  } catch (error) {
    console.error("Unable to load guardrail config", error);
    return { ...DEFAULT_GUARDRAILS, source: "default" };
  }
}
