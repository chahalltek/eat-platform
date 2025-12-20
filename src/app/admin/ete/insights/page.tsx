import Link from 'next/link';

import { ETEClientLayout } from '@/components/ETEClientLayout';
import { DEFAULT_TENANT_ID } from '@/lib/auth/config';
import { isAdminOrDataAccessRole } from '@/lib/auth/roles';
import { getCurrentUser } from '@/lib/auth/user';
import { getCurrentTenantId } from '@/lib/tenant';
import { InsightsAdminClient } from './InsightsAdminClient';
import { listInsightSnapshots, listPublishedBenchmarkReleases } from '@/lib/publishing/insightSnapshots';

export const dynamic = 'force-dynamic';

function AccessDenied() {
  return (
    <ETEClientLayout>
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-xl font-semibold">Admin access required</h1>
          <p className="mt-2 text-sm text-amber-800">
            You need to be a tenant admin for this workspace to manage insight snapshots.
          </p>
          <div className="mt-4">
            <Link href="/" className="text-sm font-medium text-amber-900 underline">
              Back to Console
            </Link>
          </div>
        </div>
      </main>
    </ETEClientLayout>
  );
}

export default async function InsightsPage() {
  const user = await getCurrentUser();
  const tenantId = (await getCurrentTenantId()) ?? user?.tenantId ?? DEFAULT_TENANT_ID;

  if (!user || !isAdminOrDataAccessRole(user.role) || (user.tenantId ?? DEFAULT_TENANT_ID) !== tenantId) {
    return <AccessDenied />;
  }

  const releases = await listPublishedBenchmarkReleases();
  const benchmarksUnavailable = releases.length === 0;

  let snapshots = [] as Awaited<ReturnType<typeof listInsightSnapshots>>;
  let storageError: string | null = null;

  try {
    snapshots = await listInsightSnapshots();
  } catch (error) {
    storageError = error instanceof Error ? error.message : 'Insight snapshot storage is unavailable.';
  }

  return (
    <ETEClientLayout>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <InsightsAdminClient
          initialSnapshots={snapshots}
          releases={releases}
          storageError={storageError}
          benchmarksUnavailable={benchmarksUnavailable}
        />
      </main>
    </ETEClientLayout>
  );
}
