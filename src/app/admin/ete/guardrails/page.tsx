import Link from "next/link";

import { ETEClientLayout } from "@/components/ETEClientLayout";
import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { isAdminOrDataAccessRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/user";
import { getCurrentTenantId } from "@/lib/tenant";

import { GuardrailsEditor } from "./GuardrailsEditor";

export const dynamic = "force-dynamic";

function AccessDenied() {
  return (
    <ETEClientLayout>
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-xl font-semibold">Admin access required</h1>
          <p className="mt-2 text-sm text-amber-800">
            You need to be a tenant admin for this workspace to adjust guardrails.
          </p>
          <div className="mt-4">
            <Link href="/" className="text-sm font-medium text-amber-900 underline">
              Return to home
            </Link>
          </div>
        </div>
      </main>
    </ETEClientLayout>
  );
}

export default async function GuardrailsPage() {
  const user = await getCurrentUser();
  const tenantId = await getCurrentTenantId();
  const userTenant = (user?.tenantId ?? DEFAULT_TENANT_ID).trim();
  const isAuthorized = user && isAdminOrDataAccessRole(user.role) && userTenant === tenantId.trim();

  if (!isAuthorized) {
    return <AccessDenied />;
  }

  return (
    <ETEClientLayout>
      <main className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-8">
          <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Admin</p>
              <h1 className="text-3xl font-semibold text-zinc-900">ETE Guardrails</h1>
              <p className="text-sm text-zinc-600">
                View and adjust guardrails for tenant <span className="font-semibold">{tenantId}</span>. Apply presets or fine-tune
                scoring, explainability, and safety controls.
              </p>
            </div>

            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700"
            >
              Back to home
            </Link>
          </header>

          <GuardrailsEditor tenantId={tenantId} />
        </div>
      </main>
    </ETEClientLayout>
  );
}
