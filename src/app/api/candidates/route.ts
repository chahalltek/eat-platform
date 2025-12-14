import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/server/db";
import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { getUserTenantId } from "@/lib/auth/user";
import { requireRecruiterOrAdmin } from "@/lib/auth/requireRole";
import { candidateProfileSchema, candidateSkillSchema } from "@/types/candidateIntake";
import { onCandidateChanged } from "@/lib/orchestration/triggers";
import { recordMetricEvent } from "@/lib/metrics/events";

const requestSchema = z.object({
  profile: candidateProfileSchema,
  tenantId: z.string().trim().optional(),
  skills: z.array(candidateSkillSchema).optional(),
  jobReqId: z.string().trim().optional(),
});

export async function GET(req: NextRequest) {
  const roleCheck = await requireRecruiterOrAdmin(req);

  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  const tenantId = (await getUserTenantId(req)) ?? DEFAULT_TENANT_ID;

  try {
    const candidates = await prisma.candidate.findMany({
      where: { tenantId },
      include: {
        skills: {
          select: {
            id: true,
          },
        },
        jobCandidates: {
          select: {
            confidenceScore: true,
            confidenceBand: true,
            confidenceNarrative: true,
            confidenceUpdatedAt: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });

    const rows = candidates.map((candidate) => ({
      id: candidate.id,
      fullName: candidate.fullName,
      currentTitle: candidate.currentTitle,
      location: candidate.location,
      status: candidate.status,
      parsingConfidence: candidate.parsingConfidence,
      confidence:
        candidate.jobCandidates[0]
          ? {
              score: candidate.jobCandidates[0].confidenceScore ?? null,
              band: candidate.jobCandidates[0].confidenceBand ?? null,
              narrative: candidate.jobCandidates[0].confidenceNarrative ?? null,
              updatedAt:
                candidate.jobCandidates[0].confidenceUpdatedAt?.toISOString() ??
                candidate.jobCandidates[0].updatedAt.toISOString(),
            }
          : null,
      updatedAt: candidate.updatedAt.toISOString(),
    }));

    return NextResponse.json({ candidates: rows }, { status: 200 });
  } catch (error) {
    console.error("[Candidates API] Failed to fetch candidates", error);
    return NextResponse.json({ error: "Unable to load candidates" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const roleCheck = await requireRecruiterOrAdmin(req);

  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  let parsedBody: z.infer<typeof requestSchema>;

  try {
    parsedBody = requestSchema.parse(await req.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const tenantId = (parsedBody.tenantId || (await getUserTenantId(req)) || DEFAULT_TENANT_ID).trim();
  const { profile } = parsedBody;
  const jobReqId = parsedBody.jobReqId?.trim();

  const jobReq = jobReqId
    ? await prisma.jobReq.findUnique({ where: { id: jobReqId, tenantId }, select: { id: true, tenantId: true } })
    : null;

  try {
    const candidate = await prisma.candidate.create({
      data: {
        tenantId,
        fullName: profile.fullName,
        email: null,
        phone: null,
        location: profile.location ?? null,
        currentTitle: profile.currentTitle ?? null,
        currentCompany: null,
        totalExperienceYears: profile.totalExperienceYears ?? null,
        seniorityLevel: profile.seniorityLevel ?? null,
        summary: profile.summary ?? null,
        rawResumeText: profile.rawResumeText ?? null,
        parsingConfidence: profile.parsingConfidence ?? null,
        skills: {
          create: (parsedBody.skills ?? profile.skills).map((skill) => ({
            tenantId,
            name: skill.name,
            normalizedName: skill.normalizedName || skill.name,
            proficiency: skill.proficiency ?? null,
            yearsOfExperience: skill.yearsOfExperience ?? null,
          })),
        },
      },
    });

    if (jobReq) {
      void onCandidateChanged({ tenantId: jobReq.tenantId, jobId: jobReq.id, candidateIds: [candidate.id] });
    }

    void recordMetricEvent({
      tenantId,
      eventType: "CANDIDATE_INGESTED",
      entityId: candidate.id,
      meta: {
        jobReqId: jobReqId ?? undefined,
        skillsCount: (parsedBody.skills ?? profile.skills ?? []).length,
        parsingConfidence: profile.parsingConfidence ?? null,
      },
    });

    return NextResponse.json(candidate, { status: 201 });
  } catch (error) {
    console.error("Failed to save candidate", error);
    return NextResponse.json({ error: "Unable to save candidate" }, { status: 500 });
  }
}
