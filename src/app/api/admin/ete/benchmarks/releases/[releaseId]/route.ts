import { NextRequest, NextResponse } from "next/server";

import { getBenchmarkRelease, type BenchmarkReleaseWithMetrics } from "@/lib/benchmarks/buildBenchmarkRelease";
import { isAdminRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/user";

export const dynamic = "force-dynamic";

type SerializedBenchmarkMetric =
  | (BenchmarkReleaseWithMetrics["metrics"] extends Array<infer Metric> ? Metric : never)
  | never;

type BenchmarkReleaseResponse = Omit<
  BenchmarkReleaseWithMetrics,
  "createdAt" | "publishedAt" | "metrics"
> & {
  createdAt: string;
  publishedAt: string | null;
  metrics: Array<Omit<SerializedBenchmarkMetric, "createdAt"> & { createdAt: string }>;
};

function serializeReleaseWithMetrics(release: BenchmarkReleaseWithMetrics): BenchmarkReleaseResponse {
  return {
    ...release,
    createdAt: release.createdAt.toISOString(),
    publishedAt: release.publishedAt ? release.publishedAt.toISOString() : null,
    metrics: release.metrics.map((metric) => ({
      ...metric,
      createdAt: metric.createdAt.toISOString(),
    })),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ releaseId: string }> }
) {
  const { releaseId } = await params;

  const user = await getCurrentUser(request);

  if (!user || !isAdminRole(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const release = await getBenchmarkRelease(releaseId);

  if (!release) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ release: serializeReleaseWithMetrics(release) });
}
