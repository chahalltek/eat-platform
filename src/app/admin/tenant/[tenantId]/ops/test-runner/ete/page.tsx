import Link from "next/link";

import { ETEClientLayout } from "@/components/ETEClientLayout";
import { getTenantAdminPageAccess } from "@/lib/tenant/tenantAdminPageAccess";
import { getTenantTestRunnerCatalog } from "@/lib/testing/testCatalog";

import { EteTestRunnerClient } from "./EteTestRunnerClient";

export const dynamic = "force-dynamic";

function AccessDenied({ message }: { message: string }) {
  return (
    <ETEClientLayout showFireDrillBanner={false} contentClassName="flex justify-center">
      <div className="w-full max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h1 className="text-xl font-semibold">Admin access required</h1>
        <p className="mt-2 text-sm text-amber-800">{message}</p>
        <div className="mt-4">
          <Link href="/" className="text-sm font-medium text-amber-900 underline">
            Return to home
          </Link>
        </div>
      </div>
    </ETEClientLayout>
  );
}

export default async function EteTestRunnerPage({ params }: { params: { tenantId?: string } }) {
  const { tenantId: requestedTenant, isAllowed } = await getTenantAdminPageAccess({ tenantId: params.tenantId });

  if (!isAllowed) {
    return <AccessDenied message="Switch to a tenant admin account to view this test runner." />;
  }

  const catalog = getTenantTestRunnerCatalog();

  return (
    <ETEClientLayout showFireDrillBanner={false}>
      <EteTestRunnerClient catalog={catalog} tenantId={requestedTenant} isVercelLimited={Boolean(process.env.VERCEL)} />
    </ETEClientLayout>
  );
}
