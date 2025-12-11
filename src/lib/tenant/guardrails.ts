import { z } from "zod";

import { isPrismaUnavailableError, isTableAvailable, prisma } from "@/lib/prisma";

export const guardrailsSchema = z
  .object({
    scoring: z.object({
      strategy: z.enum(["simple", "weighted"]),
      weights: z.object({
        mustHaveSkills: z.number().min(0),
        niceToHaveSkills: z.number().min(0),
        experience: z.number().min(0),
        location: z.number().min(0),
      }),
      thresholds: z.object({
        minMatchScore: z.number().min(0),
        shortlistMinScore: z.number().min(0),
        shortlistMaxCandidates: z.number().int().positive(),
      }),
    }),
    explain: z.object({
      level: z.enum(["compact", "detailed"]),
      includeWeights: z.boolean(),
    }),
    safety: z.object({
      requireMustHaves: z.boolean(),
      excludeInternalCandidates: z.boolean(),
    }),
  })
  .refine((value) => value.scoring.thresholds.shortlistMinScore >= value.scoring.thresholds.minMatchScore, {
    message: "Shortlist min score must be greater than or equal to min match score",
    path: ["scoring", "thresholds", "shortlistMinScore"],
  });

export type TenantGuardrails = z.infer<typeof guardrailsSchema>;

type PartialTenantGuardrails = {
  scoring?: Partial<TenantGuardrails["scoring"]>;
  explain?: Partial<TenantGuardrails["explain"]>;
  safety?: Partial<TenantGuardrails["safety"]>;
};

export const defaultTenantGuardrails: TenantGuardrails = {
  scoring: {
    strategy: "weighted",
    weights: {
      mustHaveSkills: 40,
      niceToHaveSkills: 20,
      experience: 25,
      location: 15,
    },
    thresholds: {
      minMatchScore: 60,
      shortlistMinScore: 75,
      shortlistMaxCandidates: 10,
    },
  },
  explain: {
    level: "compact",
    includeWeights: true,
  },
  safety: {
    requireMustHaves: true,
    excludeInternalCandidates: false,
  },
};

function mergeGuardrails(
  override: PartialTenantGuardrails | null | undefined,
): TenantGuardrails {
  return guardrailsSchema.parse({
    scoring: {
      strategy: override?.scoring?.strategy ?? defaultTenantGuardrails.scoring.strategy,
      weights: {
        ...defaultTenantGuardrails.scoring.weights,
        ...(override?.scoring?.weights ?? {}),
      },
      thresholds: {
        ...defaultTenantGuardrails.scoring.thresholds,
        ...(override?.scoring?.thresholds ?? {}),
      },
    },
    explain: {
      ...defaultTenantGuardrails.explain,
      ...(override?.explain ?? {}),
    },
    safety: {
      ...defaultTenantGuardrails.safety,
      ...(override?.safety ?? {}),
    },
  });
}

async function ensureTenantConfigTable() {
  if (await isTableAvailable("TenantConfig")) {
    return true;
  }

  return false;
}

export async function loadTenantGuardrails(tenantId: string): Promise<TenantGuardrails> {
  if (!(await ensureTenantConfigTable())) {
    return defaultTenantGuardrails;
  }

  const record = await prisma.tenantConfig.findFirst({ where: { tenantId } }).catch((error) => {
    if (isPrismaUnavailableError(error)) return null;

    throw error;
  });

  const storedGuardrails =
    ((record as { guardrails?: unknown } | null | undefined)?.guardrails as
      | PartialTenantGuardrails
      | null
      | undefined) ?? null;

  const stored =
    storedGuardrails ??
    (record
      ? {
          scoring: record.scoring as Partial<TenantGuardrails["scoring"]> | undefined,
          explain: record.explain as Partial<TenantGuardrails["explain"]> | undefined,
          safety: record.safety as Partial<TenantGuardrails["safety"]> | undefined,
        }
      : null);
  try {
    return mergeGuardrails(stored);
  } catch (error) {
    console.error("Invalid guardrails config detected, using defaults", error);
    return defaultTenantGuardrails;
  }
}

export async function saveTenantGuardrails(
  tenantId: string,
  payload: unknown,
): Promise<{ saved: TenantGuardrails; created: boolean }>
export async function saveTenantGuardrails(tenantId: string, payload: unknown) {
  const parsed = guardrailsSchema.parse(payload);

  if (!(await ensureTenantConfigTable())) {
    throw new Error("TenantConfig table is unavailable");
  }

  const existing = await prisma.tenantConfig.findFirst({ where: { tenantId } });

  await prisma.tenantConfig.upsert({
    where: { tenantId },
    create: {
      tenantId,
      scoring: parsed.scoring,
      explain: parsed.explain,
      safety: parsed.safety,
    },
    update: {
      scoring: parsed.scoring,
      explain: parsed.explain,
      safety: parsed.safety,
    },
  });

  return { saved: parsed, created: !existing };
}
