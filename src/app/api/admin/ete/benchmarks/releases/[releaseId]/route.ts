import { NextRequest, NextResponse } from "next/server";

import { getBenchmarkRelease, type BenchmarkReleaseWithMetrics } from "@/lib/benchmarks/buildBenchmarkRelease";
import { isAdminRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/user";

export const dynamic = "force-dynamic";

type BenchmarkReleaseResponse = ReturnType<typeof serializeReleaseWithMetrics>;

function serializeReleaseWithMetrics(release: BenchmarkReleaseWithMetrics) {
  return {
    ...release,
    createdAt: release.createdAt.toISOString(),
    publishedAt: release.publishedAt ? release.publishedAt.toISOString() : null,
    metrics: release.metrics.map((metric) => ({
      ...metric,
      createdAt: metric.createdAt.toISOString(),
    })),
  } satisfies BenchmarkReleaseResponse;
}

export async function GET(request: NextRequest, { params }: { params: { releaseId: string } }) {
  const user = await getCurrentUser(request);

  if (!user || !isAdminRole(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const release = await getBenchmarkRelease(params.releaseId);

  if (!release) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ release: serializeReleaseWithMetrics(release) });
}
