import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import type { TestCatalogItem } from "@/lib/testing/testCatalog";
import { getCurrentUser } from "@/lib/auth/user";
import { getCurrentTenantId } from "@/lib/tenant";
import { resolveTenantAdminAccess } from "@/lib/tenant/access";
import { getTenantRoleFromHeaders } from "@/lib/tenant/roles";

<<<<<<< ours
import { TenantAdminShell } from "../../TenantAdminShell";
import { OpsTestRunnerClient } from "./OpsTestRunnerClient";

=======
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
  const user = await getCurrentUser();
  const tenantId = params.tenantId?.trim?.() ?? "";
  const headerRole = getTenantRoleFromHeaders(await headers());
  const currentTenantId = await getCurrentTenantId();
  const targetTenantId = tenantId || currentTenantId || "";

  const access = await resolveTenantAdminAccess(user, targetTenantId, { roleHint: headerRole });

  if (!access.hasAccess) {
    return <AccessDenied />;
  }

<<<<<<< ours
  const headerStore = await headers();
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? process.env.VERCEL_URL;
  const baseUrl = host?.startsWith("http") ? host : `${protocol}://${host ?? "localhost:3000"}`;

  const response = await fetch(`${baseUrl}/api/admin/testing/catalog`, {
    headers: {
      cookie: headerStore.get("cookie") ?? "",
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    return (
      <TenantAdminShell tenantId={targetTenantId}>
        <div className="mx-auto max-w-4xl space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <p className="text-lg font-semibold">Unable to load the test runner catalog</p>
          <p className="text-sm">Status {response.status}: {response.statusText || "Unknown error"}</p>
          <p className="text-sm text-amber-800">Try refreshing the page or check your admin session.</p>
        </div>
      </TenantAdminShell>
    );
  }

  const payload = (await response.json()) as { items?: TestCatalogItem[] };
  const catalog = payload.items ?? [];

  return (
    <TenantAdminShell tenantId={targetTenantId}>
      <OpsTestRunnerClient catalog={catalog} />
    </TenantAdminShell>
  );
=======
  redirect(`/admin/tenant/${targetTenantId}/test-runner/ete`);
>>>>>>> theirs
}
