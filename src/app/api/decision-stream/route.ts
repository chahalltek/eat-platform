import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { canCreateDecision } from "@/lib/auth/permissions";
import { requireRecruiterOrAdmin } from "@/lib/auth/requireRole";
import { prisma } from "@/server/db/prisma";
import { tradeoffDeclarationSchema } from "@/lib/matching/tradeoffs";

const payloadSchema = z.object({
  jobId: z.string().trim().min(1),
  tradeoffs: tradeoffDeclarationSchema.partial().optional(),
});

export async function POST(req: NextRequest) {
  const roleCheck = await requireRecruiterOrAdmin(req);

  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  const body = await req.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const jobId = parsed.data.jobId.trim();
  const tenantId = (roleCheck.user.tenantId ?? DEFAULT_TENANT_ID).trim();

  if (!canCreateDecision(roleCheck.user, tenantId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const existingStream = await prisma.metricEvent.findFirst({
      where: {
        tenantId,
        eventType: "DECISION_STREAM_CREATED",
        meta: {
          path: ["jobId"],
          equals: jobId,
        },
        AND: [
          {
            meta: {
              path: ["actorId"],
              equals: roleCheck.user.id,
            },
          },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingStream) {
      if (parsed.data.tradeoffs) {
        await prisma.metricEvent
          .update({
            where: { id: existingStream.id },
            data: {
              meta: {
                ...(existingStream.meta as Record<string, unknown> | null | undefined),
                tradeoffs: parsed.data.tradeoffs,
              },
            },
          })
          .catch(() => undefined);
      }
      return NextResponse.json({ streamId: existingStream.id });
    }

    const created = await prisma.metricEvent.create({
      data: {
        tenantId,
        eventType: "DECISION_STREAM_CREATED",
        entityId: jobId,
        meta: {
          jobId,
          actorId: roleCheck.user.id,
          actorEmail: roleCheck.user.email,
          actorRole: roleCheck.user.role,
          tradeoffs: parsed.data.tradeoffs ?? null,
        },
      },
    });

    return NextResponse.json({ streamId: created.id });
  } catch (error) {
    console.error("Failed to initialize decision stream", error);
    return NextResponse.json({ error: "Unable to initialize decision stream" }, { status: 500 });
  }
}
