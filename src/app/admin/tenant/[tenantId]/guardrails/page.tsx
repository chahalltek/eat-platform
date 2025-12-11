import Link from "next/link";
<<<<<<< ours

import { requireTenantAdmin } from "@/lib/auth/tenantAdmin";
import { getCurrentUser } from "@/lib/auth/user";
import { getCurrentTenantId } from "@/lib/tenant";

import { GuardrailsForm } from "./GuardrailsForm";

export const dynamic = "force-dynamic";

export default async function GuardrailsPage({ params }: { params: { tenantId?: string } }) {
  const user = await getCurrentUser();
  const tenantId = params.tenantId?.trim?.();

  if (!user || !tenantId) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-xl font-semibold">Admin access required</h1>
          <p className="mt-2 text-sm text-amber-800">You need to be a tenant admin to manage guardrails.</p>
=======
import { headers } from "next/headers";

import { ETEClientLayout } from "@/components/ETEClientLayout";
import { getCurrentUser } from "@/lib/auth/user";
import { getCurrentTenantId } from "@/lib/tenant";
import { resolveTenantAdminAccess } from "@/lib/tenant/access";
import { getTenantRoleFromHeaders } from "@/lib/tenant/roles";

import { GuardrailsPreviewPanel } from "./GuardrailsPreviewPanel";

export const dynamic = "force-dynamic";

function AccessDenied() {
  return (
    <ETEClientLayout>
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-xl font-semibold">Admin access required</h1>
          <p className="mt-2 text-sm text-amber-800">
            You need to be a tenant admin for this workspace to adjust guardrails presets.
          </p>
>>>>>>> theirs
          <div className="mt-4">
            <Link href="/" className="text-sm font-medium text-amber-900 underline">
              Return to home
            </Link>
          </div>
        </div>
      </main>
<<<<<<< ours
    );
  }

  const normalizedTenantId = tenantId.trim();
  const access = await requireTenantAdmin(normalizedTenantId, user.id);

  if (!access.isAdmin) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-xl font-semibold">Access denied</h1>
          <p className="mt-2 text-sm text-amber-800">Only tenant admins can change guardrails.</p>
          <div className="mt-4">
            <Link href="/" className="text-sm font-medium text-amber-900 underline">
              Return to home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const currentTenantId = await getCurrentTenantId();
  const showTenantMismatchWarning = currentTenantId.trim() !== normalizedTenantId;

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Admin</p>
            <h1 className="text-3xl font-semibold text-zinc-900">Guardrails configuration</h1>
            <p className="text-sm text-zinc-600">Configure scoring, thresholds, and safety rails for this tenant.</p>
          </div>

          <Link
            href="/admin/tenants"
            className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700"
          >
            Back to tenants
          </Link>
        </header>

        {showTenantMismatchWarning ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Editing guardrails for tenant <span className="font-semibold">{normalizedTenantId}</span> while your session is scoped
            to <span className="font-semibold">{currentTenantId}</span>.
          </div>
        ) : null}

        <GuardrailsForm tenantId={normalizedTenantId} />
      </div>
    </main>
=======
    </ETEClientLayout>
  );
}

export default async function GuardrailsPage({ params }: { params: { tenantId?: string } }) {
  const user = await getCurrentUser();
  const tenantId = params.tenantId?.trim?.() ?? "";
  const headerRole = getTenantRoleFromHeaders(headers());

  if (!user || !tenantId) {
    return <AccessDenied />;
  }

  const [currentTenantId, access] = await Promise.all([
    getCurrentTenantId(),
    resolveTenantAdminAccess(user, tenantId, { roleHint: headerRole }),
  ]);

  if (!access.hasAccess) {
    return <AccessDenied />;
  }

  const normalizedTenantId = tenantId || currentTenantId || "";

  return (
    <ETEClientLayout>
      <main className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-8">
          <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Admin</p>
              <h1 className="text-3xl font-semibold text-zinc-900">Guardrails presets</h1>
              <p className="text-sm text-zinc-600">
                Preview how shortlist guardrails behave before saving changes for tenant
                <span className="font-semibold"> {normalizedTenantId}</span>.
              </p>
            </div>

            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700"
            >
              Back to home
            </Link>
          </header>

          <GuardrailsPreviewPanel tenantId={normalizedTenantId} />
        </div>
      </main>
    </ETEClientLayout>
>>>>>>> theirs
  );
}
