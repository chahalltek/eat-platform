import { BackToConsoleButton } from "@/components/BackToConsoleButton";
import { ETEClientLayout } from "@/components/ETEClientLayout";
import { canAccessExecIntelligence } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/user";
import { getDecisionQualitySignals } from "@/lib/metrics/decisionQuality";
import { ExecAccessDenied } from "../ExecAccessDenied";
import { DecisionQualityDashboard } from "./DecisionQualityDashboard";

export const dynamic = "force-dynamic";

export default async function DecisionQualityPage() {
  const user = await getCurrentUser();
  const allowed = user && canAccessExecIntelligence(user, user.tenantId);

  if (!user || !user.tenantId || !allowed) {
    return <ExecAccessDenied />;
  }

  const signals = await getDecisionQualitySignals(user.tenantId);

  return (
    <ETEClientLayout maxWidthClassName="max-w-7xl">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600">Exec Intelligence</p>
          <h1 className="text-3xl font-semibold leading-tight text-zinc-900 dark:text-zinc-50">Decision quality dashboard</h1>
          <p className="max-w-3xl text-sm text-zinc-600 dark:text-zinc-300">
            Read-only visibility into judgment quality—confidence, outcomes, and risky approvals—built from ETE signals so leaders can steer without waiting on ATS data.
          </p>
        </div>
        <BackToConsoleButton />
      </div>

      <DecisionQualityDashboard signals={signals} />
    </ETEClientLayout>
  );
}
