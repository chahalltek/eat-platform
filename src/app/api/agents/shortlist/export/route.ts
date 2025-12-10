import { NextRequest, NextResponse } from "next/server";
import { JobCandidateStatus } from "@prisma/client";

import { computeCandidateConfidenceScore } from "@/lib/candidates/confidenceScore";
import { getTenantScopedPrismaClient, toTenantErrorResponse } from "@/lib/agents/tenantScope";
import { requireRole } from "@/lib/auth/requireRole";
import { USER_ROLES } from "@/lib/auth/roles";

export async function GET(req: NextRequest) {
  const roleCheck = await requireRole(req, [USER_ROLES.ADMIN, USER_ROLES.RECRUITER]);

  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  const jobReqId = req.nextUrl.searchParams.get("jobReqId")?.trim();

  if (!jobReqId) {
    return NextResponse.json({ error: "jobReqId is required" }, { status: 400 });
  }

  let scopedTenant;

  try {
    scopedTenant = await getTenantScopedPrismaClient(req);
  } catch (error) {
    const tenantError = toTenantErrorResponse(error);

    if (tenantError) {
      return tenantError;
    }

    throw error;
  }

  const { prisma, tenantId, runWithTenantContext } = scopedTenant;

  return runWithTenantContext(async () => {
    const jobReq = await prisma.jobReq.findUnique({
      where: { id: jobReqId, tenantId },
      select: {
        id: true,
        jobCandidates: {
          where: { status: JobCandidateStatus.SHORTLISTED },
          include: {
            candidate: {
              include: {
                skills: { select: { id: true, name: true, proficiency: true, yearsOfExperience: true } },
              },
            },
            lastMatch: true,
          },
        },
      },
    });

    if (!jobReq) {
      return NextResponse.json({ error: "Job requisition not found" }, { status: 404 });
    }

    const headers = ["Name", "Email", "Title", "Score", "Confidence", "Notes"];

    const rows = jobReq.jobCandidates.map((jobCandidate) => {
      const confidence = computeCandidateConfidenceScore({
        candidate: { ...jobCandidate.candidate, skills: jobCandidate.candidate.skills },
      });

      return [
        jobCandidate.candidate.fullName ?? "Name not provided",
        jobCandidate.candidate.email ?? "",
        jobCandidate.candidate.currentTitle ?? jobCandidate.candidate.currentCompany ?? "",
        typeof jobCandidate.lastMatch?.score === "number" ? `${jobCandidate.lastMatch.score}%` : "",
        `${confidence.score}%`,
        jobCandidate.notes ?? "",
      ];
    });

    const escapeCsv = (value: unknown) =>
      `"${String(value ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;

    const csvLines = [
      headers.map(escapeCsv).join(","),
      ...rows.map((row) => row.map(escapeCsv).join(",")),
    ];

    const csvContent = csvLines.join("\r\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="shortlist_${jobReq.id}.csv"`,
      },
    });
  });
}
