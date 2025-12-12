import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { logGuardrailsUpdate } from "@/lib/audit/adminAudit";
import { requireTenantAdmin } from "@/lib/auth/requireTenantAdmin";
import { loadTenantConfig } from "@/lib/guardrails/loadTenantConfig";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const guardrailsPayloadSchema = z
  .object({
    preset: z.enum(["conservative", "balanced", "aggressive"]).nullable().optional(),
    scoring: z.object({
      strategy: z.enum(["simple", "weighted"]),
      weights: z.object({
        mustHaveSkills: z.number(),
        niceToHaveSkills: z.number(),
        experience: z.number(),
        location: z.number(),
      }),
      thresholds: z.object({
        minMatchScore: z.number(),
        shortlistMinScore: z.number(),
        shortlistMaxCandidates: z.number().int(),
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
  .superRefine((value, ctx) => {
    const { minMatchScore, shortlistMinScore, shortlistMaxCandidates } = value.scoring.thresholds;

    if (minMatchScore < 0 || minMatchScore > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scoring", "thresholds", "minMatchScore"],
        message: "minMatchScore must be between 0 and 1",
      });
    }

    if (shortlistMinScore < 0 || shortlistMinScore > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scoring", "thresholds", "shortlistMinScore"],
        message: "shortlistMinScore must be between 0 and 1",
      });
    }

    if (shortlistMaxCandidates < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scoring", "thresholds", "shortlistMaxCandidates"],
        message: "shortlistMaxCandidates must be at least 1",
      });
    }
  });

type GuardrailsPayload = z.infer<typeof guardrailsPayloadSchema>;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;
  const access = await requireTenantAdmin(request, tenantId);
  if (!access.ok) {
    return access.response;
  }

  const config = await loadTenantConfig(tenantId);

  return NextResponse.json(config);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;
  try {
    const access = await requireTenantAdmin(request, tenantId);
    if (!access.ok) {
      return access.response;
    }

    const payload = guardrailsPayloadSchema.parse(await request.json()) as GuardrailsPayload;

    await prisma.tenantConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        preset: payload.preset ?? null,
        scoring: payload.scoring,
        explain: payload.explain,
        safety: payload.safety,
      },
      update: {
        preset: payload.preset ?? null,
        scoring: payload.scoring,
        explain: payload.explain,
        safety: payload.safety,
      },
    });

    await logGuardrailsUpdate({
      tenantId,
      actorId: access.user.id,
      preset: payload.preset ?? null,
      scoringStrategy: payload.scoring.strategy,
      thresholds: payload.scoring.thresholds,
      explain: payload.explain,
      safety: payload.safety,
    });

    const config = await loadTenantConfig(tenantId);

    return NextResponse.json(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
