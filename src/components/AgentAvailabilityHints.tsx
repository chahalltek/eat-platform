import clsx from "clsx";
import Link from "next/link";
import { InformationCircleIcon } from "@heroicons/react/24/outline";

import { getAgentAvailability } from "@/lib/agents/agentAvailability";
import { getCurrentTenantId } from "@/lib/tenant";

const AGENT_ORDER = ["RINA", "RUA", "MATCH", "CONFIDENCE", "EXPLAIN", "SHORTLIST"] as const;
const AGENT_GROUPS = [
  { label: "Intake", agents: ["RUA", "RINA"] as const },
  { label: "Reasoning", agents: ["MATCH", "CONFIDENCE", "EXPLAIN"] as const },
  { label: "Output", agents: ["SHORTLIST"] as const },
] as const;

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
  const runtimeControlsHref = `/admin/tenant/${tenantId}/ops/runtime-controls#execution-mode`;

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
  const agentLookup = new Map(agents.map((agent) => [agent.name, agent]));
  const groupedAgents = AGENT_GROUPS.map((group) => ({
    label: group.label,
    members: group.agents
      .map((agentName) => agentLookup.get(agentName))
      .filter((agent): agent is (typeof agents)[number] => Boolean(agent)),
  }));

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
        <Link
          href={runtimeControlsHref}
          className={clsx(
            "inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold transition hover:shadow-sm",
            headerTone === "amber"
              ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100"
              : "bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200 hover:bg-indigo-100",
          )}
        >
          {headerTone === "amber" ? "Fire Drill safeguards" : "Mode-based allowances"}
        </Link>
      </div>

      <div className="mt-4 space-y-4">
        {groupedAgents.map((group) => (
          <div key={group.label} className="space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
              <span className="h-px w-4 rounded-full bg-slate-300" aria-hidden />
              <span>{group.label}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.members.map((agent) => (
                <div
                  key={agent.name}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-semibold text-slate-900">{agent.name}</p>
                      <div className="flex items-center gap-1 text-xs text-slate-600">
                        <InformationCircleIcon className="h-4 w-4 text-slate-400" aria-hidden title={agent.description} />
                        <span className="line-clamp-1">{agent.description}</span>
                      </div>
                    </div>
                    <span
                      className={clsx(
                        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
                        agent.enabled
                          ? "bg-slate-100 text-slate-900 ring-1 ring-slate-200"
                          : "bg-rose-100 text-rose-800 ring-1 ring-rose-200",
                      )}
                    >
                      <span
                        className={clsx(
                          "h-2 w-2 rounded-full",
                          agent.enabled ? "bg-slate-500" : "bg-rose-500",
                        )}
                        aria-hidden
                      />
                      {agent.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  {!agent.enabled && agent.modeReason ? (
                    <p className="mt-2 text-xs font-medium text-rose-700">{agent.modeReason}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
