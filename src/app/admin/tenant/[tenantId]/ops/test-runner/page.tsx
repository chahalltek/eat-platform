import Link from "next/link";
import { redirect } from "next/navigation";

<<<<<<< ours
import { getCurrentUser } from "@/lib/auth/user";
import { getCurrentTenantId, getTenantFromParamsOrSession } from "@/lib/tenant";
import { resolveTenantAdminAccess } from "@/lib/tenant/access";
import { getTenantRoleFromHeaders } from "@/lib/tenant/roles";
=======
import { getTenantAdminPageAccess } from "@/lib/tenant/tenantAdminPageAccess";
>>>>>>> theirs

export const dynamic = "force-dynamic";

function AccessDenied() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h1 className="text-xl font-semibold">Admin access required</h1>
        <p className="mt-2 text-sm text-amber-800">
          You need to be a tenant admin for this workspace to open the ops test runner.
        </p>
        <div className="mt-4">
          <Link href="/" className="text-sm font-medium text-amber-900 underline">
            Return to home
          </Link>
        </div>
      </div>
    </main>
  );
}

export default async function TenantTestRunnerPage({ params }: { params: { tenantId?: string } }) {
<<<<<<< ours
  const user = await getCurrentUser();
  const tenantId = params.tenantId?.trim?.() ?? "";
  const headerRole = getTenantRoleFromHeaders(await headers());
  const currentTenantId = await getCurrentTenantId();
  const targetTenantId = getTenantFromParamsOrSession(tenantId, currentTenantId);
=======
  const { tenantId: targetTenantId, isAllowed } = await getTenantAdminPageAccess({ tenantId: params.tenantId });
>>>>>>> theirs

  if (!isAllowed) {
    return <AccessDenied />;
  }

  redirect(`/admin/tenant/${targetTenantId}/ops/test-runner/ete`);
}
