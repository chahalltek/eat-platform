import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LegacyTenantTestRunnerPage({ params }: { params: { tenantId?: string } }) {
  const tenantId = params.tenantId?.trim?.();

  if (!tenantId) {
    redirect("/admin");
  }

  redirect(`/admin/tenant/${tenantId}/ops/test-runner/ete`);
}
