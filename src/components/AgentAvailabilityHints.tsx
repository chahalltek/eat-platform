import clsx from "clsx";

import { getAgentAvailability } from "@/lib/agents/agentAvailability";
import { getCurrentTenantId } from "@/lib/tenant";

const AGENT_ORDER = ["RINA", "RUA", "MATCH", "CONFIDENCE", "EXPLAIN", "SHORTLIST"] as const;

const agentDescriptions: Record<(typeof AGENT_ORDER)[number], string> = {
  RINA: "Resume ingestion",
  RUA: "Job intake",
  MATCH: "Deterministic matcher",
  CONFIDENCE: "Quality gate (Confidence)",
  EXPLAIN: "Explainability",
  SHORTLIST: "Shortlist exporter",
};

function formatModeName(mode: string) {
  return mode.replace("_", " ");
}

export async function AgentAvailabilityHints({ className }: { className?: string }) {
  const tenantId = await getCurrentTenantId();
  const availability = await getAgentAvailability(tenantId);

  const agents = AGENT_ORDER.map((agentName) => {
    const enabled = availability.isEnabled(agentName);
    const allowedByMode = availability.mode.agentsEnabled.includes(agentName);
    const modeReason = allowedByMode ? null : `${formatModeName(availability.mode.mode)} mode disables ${agentName}`;

    return {
      name: agentName,
      description: agentDescriptions[agentName],
      enabled,
      modeReason,
    };
  });

  const headerTone = availability.mode.mode === "fire_drill" ? "amber" : "indigo";

  return (
    <section
      className={clsx(
        "rounded-2xl border bg-white p-6 shadow-sm",
        headerTone === "amber" ? "border-amber-200" : "border-slate-200",
        className,
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">Agent availability</p>
          <p className="text-sm text-slate-600">
            Current mode: <span className="font-semibold text-slate-900">{formatModeName(availability.mode.mode)}</span>
          </p>
          <p className="text-xs text-slate-500">
            Availability reflects mode defaults and any kill switches. Fire Drill forces Explain and Confidence off.
          </p>
        </div>
        <span
          className={clsx(
            "inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold",
            headerTone === "amber"
              ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
              : "bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200",
          )}
        >
          {headerTone === "amber" ? "Fire Drill safeguards" : "Mode-based allowances"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <div
            key={agent.name}
            className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-800"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <p className="text-sm font-semibold text-slate-900">{agent.name}</p>
                <p className="text-xs text-slate-600">{agent.description}</p>
              </div>
              <span
                className={clsx(
                  "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
                  agent.enabled ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800",
                )}
              >
                <span className="h-2 w-2 rounded-full bg-current" aria-hidden />
                {agent.enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            {!agent.enabled && agent.modeReason ? (
              <p className="mt-2 text-xs font-medium text-rose-700">{agent.modeReason}</p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
