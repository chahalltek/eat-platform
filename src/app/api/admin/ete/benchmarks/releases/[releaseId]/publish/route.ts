import { NextRequest, NextResponse } from "next/server";

import { getBenchmarkRelease, publishBenchmarkRelease } from "@/lib/benchmarks/buildBenchmarkRelease";
import { isAdminRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/user";

export const dynamic = "force-dynamic";

function serialize(release: Awaited<ReturnType<typeof getBenchmarkRelease>>) {
  if (!release) return release;

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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ releaseId: string }> },
) {
  const { releaseId } = await params;
  const user = await getCurrentUser(request);

  if (!user || !isAdminRole(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await publishBenchmarkRelease(releaseId);
    const release = await getBenchmarkRelease(releaseId);
    return NextResponse.json({ release: serialize(release) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to publish release";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
