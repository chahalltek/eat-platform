import Link from "next/link";

import { ETEClientLayout } from "@/components/ETEClientLayout";
import { normalizeRole, USER_ROLES } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/user";
import { StrategicCopilotClient } from "./StrategicCopilotClient";

export const dynamic = "force-dynamic";

function AccessDenied() {
  return (
    <ETEClientLayout>
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-xl font-semibold">Access limited to execs and admins</h1>
          <p className="mt-2 text-sm text-amber-800">
            The ETE Strategic Copilot is available to executive and admin roles only.
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

export default async function StrategicCopilotPage() {
  const user = await getCurrentUser();
  const role = normalizeRole(user?.role);
  const allowed =
    role === USER_ROLES.ADMIN || role === USER_ROLES.SYSTEM_ADMIN || role === USER_ROLES.MANAGER;

  if (!user || !allowed) {
    return <AccessDenied />;
  }

  const displayName = user.displayName ?? user.email ?? "You";

  return (
    <ETEClientLayout>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300">
            ETE Strategic Copilot
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-zinc-100">
            Natural language answers with evidence
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-600 dark:text-zinc-400">
            Ask strategy questions and get responses grounded in benchmarks, forecasts, market signals, and L2 outcomes. Every answer cites the evidence it used and avoids acting on Bullhorn or ATS records.
          </p>
        </div>

        <div className="mt-6">
          <StrategicCopilotClient tenantId={user.tenantId ?? "default-tenant"} userLabel={displayName} />
        </div>
      </main>
    </ETEClientLayout>
  );
}
