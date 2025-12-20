import { ETEClientLayout } from "@/components/ETEClientLayout";
import { canManageFeatureFlags } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/user";
import { getAdminTestingCatalog } from "@/lib/admin/testing/catalog";
import { BackToConsoleButton } from "@/components/BackToConsoleButton";

import { AdminEteTestsClient } from "./AdminEteTestsClient";

export const dynamic = "force-dynamic";

function AccessDenied() {
  return (
    <ETEClientLayout showFireDrillBanner={false}>
      <div className="mb-4 flex justify-end">
        <BackToConsoleButton />
      </div>
      <div className="mx-auto max-w-4xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h1 className="text-xl font-semibold">Admins only</h1>
        <p className="mt-2 text-sm text-amber-800">
          You need an admin role to view the ETE on-demand test catalog. Switch to an admin user to continue.
        </p>
      </div>
    </ETEClientLayout>
  );
}

export default async function AdminEteTestsPage() {
  const user = await getCurrentUser();
  const catalog = getAdminTestingCatalog();

  if (!canManageFeatureFlags(user)) {
    return <AccessDenied />;
  }

  return (
    <ETEClientLayout showFireDrillBanner={false}>
      <div className="mb-4 flex justify-end">
        <BackToConsoleButton />
      </div>
      <AdminEteTestsClient
        quickCommands={catalog.quickCommands}
        tests={catalog.tests}
        isVercelLimited={Boolean(process.env.VERCEL)}
      />
    </ETEClientLayout>
  );
}
