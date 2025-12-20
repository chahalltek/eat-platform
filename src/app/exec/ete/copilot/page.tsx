import { ETEClientLayout } from "@/components/ETEClientLayout";
import { canUseStrategicCopilot } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/user";
import { ExecAccessDenied } from "../ExecAccessDenied";
import { StrategicCopilotClient } from "./StrategicCopilotClient";
import { BackToConsoleButton } from "@/components/BackToConsoleButton";

export const dynamic = "force-dynamic";

export default async function StrategicCopilotPage() {
  const user = await getCurrentUser();
  const allowed = user && canUseStrategicCopilot(user, user.tenantId);

  if (!user || !allowed) {
    return <ExecAccessDenied />;
  }

  const displayName = user.displayName ?? user.email ?? "You";

  return (
    <ETEClientLayout>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-4 flex justify-end">
          <BackToConsoleButton />
        </div>
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
