import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LegacyTenantTestRunnerPage({ params }: { params: { tenantId?: string } }) {
  const tenantId = params.tenantId?.trim?.();

  if (!tenantId) {
    redirect("/admin");
  }

<<<<<<< ours
  redirect(`/admin/tenant/${tenantId}/ops/test-runner/ete`);
=======
  const access = await resolveTenantAdminAccess(user, requestedTenant, { roleHint: headerRole });
  const isGlobalWithoutMembership = access.isGlobalAdmin && !access.membership;

  if (!access.hasAccess && !isGlobalWithoutMembership) {
    return <AccessDenied message="Switch to a tenant admin account to view this test runner." />;
  }

  const catalog = getTenantTestRunnerCatalog();

  return (
    <ETEClientLayout showFireDrillBanner={false}>
      {isGlobalWithoutMembership ? (
        <div className="mx-auto mt-6 max-w-4xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Limited membership context</p>
          <p>You are accessing this tenant as a global admin without explicit tenant membership.</p>
        </div>
      ) : null}

      <EteTestRunnerClient catalog={catalog} tenantId={requestedTenant} isVercelLimited={Boolean(process.env.VERCEL)} />
    </ETEClientLayout>
  );
>>>>>>> theirs
}
