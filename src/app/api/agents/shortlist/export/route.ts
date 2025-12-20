import { NextRequest, NextResponse } from "next/server";
import { JobCandidateStatus } from "@/server/db";

import { computeCandidateConfidenceScore } from "@/lib/candidates/confidenceScore";
import { getTenantScopedPrismaClient, toTenantErrorResponse } from "@/lib/agents/tenantScope";
import { canExportShortlist } from "@/lib/auth/permissions";
import { isAdminOrDataAccessRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/user";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { assertFeatureEnabled } from "@/lib/featureFlags/middleware";
import { logDataExport } from "@/server/audit/logger";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const featureGuard = await assertFeatureEnabled(FEATURE_FLAGS.AGENTS, { featureName: "Agents" });

  if (featureGuard) {
    return featureGuard;
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
  const hasRoleAccess = isAdminOrDataAccessRole(user.role);
  const hasPermissionAccess = canExportShortlist(user, tenantId);
  if (!hasRoleAccess && !hasPermissionAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

    logDataExport({
      tenantId,
      actorId: user.id,
      exportType: "shortlist_csv",
      objectIds: jobReq.jobCandidates.map((entry) => entry.candidate.id),
      recordCount: rows.length,
    });

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="shortlist_${jobReq.id}.csv"`,
      },
    });
  });
}
