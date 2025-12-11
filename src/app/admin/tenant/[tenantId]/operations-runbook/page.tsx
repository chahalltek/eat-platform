import Link from "next/link";
import { ExclamationTriangleIcon, ShieldExclamationIcon } from "@heroicons/react/24/solid";
import { ArrowTopRightOnSquareIcon, FireIcon, WrenchScrewdriverIcon } from "@heroicons/react/24/outline";

import { EteLogo } from "@/components/EteLogo";
import { listAgentKillSwitches } from "@/lib/agents/killSwitch";
import { requireTenantAdmin } from "@/lib/auth/tenantAdmin";
import { getCurrentUser } from "@/lib/auth/user";
import { loadTenantMode } from "@/lib/modes/loadTenantMode";

export const dynamic = "force-dynamic";

const MODE_DEFINITIONS = {
  pilot: {
    label: "Pilot",
    summary: "Core agents only, conservative defaults, strict thresholds",
    usage: "Early deployments, controlled rollouts",
  },
  production: {
    label: "Production",
    summary: "Full system behavior, balanced guardrails, full agents enabled",
    usage: "Normal operating state",
  },
  sandbox: {
    label: "Sandbox",
    summary: "Looser guardrails, exploratory behavior, larger shortlists",
    usage: "Experimentation, tuning, demos",
  },
  fire_drill: {
    label: "Fire Drill",
    summary: "Only essential agents active, strictest guardrails, no LLM-dependent features",
    usage: "When upstream LLM systems or scoring pipelines are unstable",
  },
} as const;

const GUARDRAIL_PRESETS = {
  conservative: {
    name: "Conservative",
    strategy: "simple",
    weights: {
      mustHave: 4,
      niceToHave: 2,
      experience: 3,
      location: 2,
    },
    thresholds: {
      minMatchScore: 75,
      shortlistMinScore: 70,
      shortlistMaxCandidates: 10,
    },
    explainability: {
      verbosity: "compact",
      includeWeights: false,
    },
    safety: {
      requireMustHaves: true,
      excludeInternalCandidates: true,
    },
  },
  balanced: {
    name: "Balanced",
    strategy: "weighted",
    weights: {
      mustHave: 3,
      niceToHave: 2,
      experience: 3,
      location: 2,
    },
    thresholds: {
      minMatchScore: 70,
      shortlistMinScore: 65,
      shortlistMaxCandidates: 15,
    },
    explainability: {
      verbosity: "detailed",
      includeWeights: true,
    },
    safety: {
      requireMustHaves: true,
      excludeInternalCandidates: false,
    },
  },
  exploratory: {
    name: "Exploratory",
    strategy: "weighted",
    weights: {
      mustHave: 2,
      niceToHave: 3,
      experience: 2,
      location: 3,
    },
    thresholds: {
      minMatchScore: 60,
      shortlistMinScore: 55,
      shortlistMaxCandidates: 25,
    },
    explainability: {
      verbosity: "detailed",
      includeWeights: true,
    },
    safety: {
      requireMustHaves: false,
      excludeInternalCandidates: false,
    },
  },
} as const;

const AGENTS = [
  {
    key: "RUA",
    description: "Role intake",
    modeAllows: (mode: RunbookMode) => mode !== "fire_drill",
    killSwitchName: "ETE-TS.RUA",
  },
  {
    key: "RINA",
    description: "Resume ingestion",
    modeAllows: (mode: RunbookMode) => mode !== "fire_drill",
    killSwitchName: "ETE-TS.RINA",
  },
  {
    key: "MATCH",
    description: "Scoring engine",
    modeAllows: (_mode: RunbookMode) => true,
    killSwitchName: "ETE-TS.MATCHER",
  },
  {
    key: "CONFIDENCE",
    description: "Confidence banding",
    modeAllows: (mode: RunbookMode) => mode !== "pilot" && mode !== "fire_drill",
  },
  {
    key: "EXPLAIN",
    description: "Match explanation",
    modeAllows: (mode: RunbookMode) => mode !== "fire_drill",
  },
  {
    key: "SHORTLIST",
    description: "Shortlist generator",
    modeAllows: (_mode: RunbookMode) => true,
    killSwitchName: "ETE-TS.RANKER",
  },
] as const;

type RunbookMode = keyof typeof MODE_DEFINITIONS;

type GuardrailSource =
  | { preset: "Conservative" | "Balanced" | "Exploratory"; reason: string }
  | { preset: "Custom"; reason: string };

type GuardrailSnapshot =
  | (typeof GUARDRAIL_PRESETS)[keyof typeof GUARDRAIL_PRESETS] & { source: GuardrailSource };

async function getTenantMode(tenantId: string): Promise<RunbookMode> {
  const resolved = await loadTenantMode(tenantId);

  return resolved.mode;
}

function resolveGuardrails(mode: RunbookMode): GuardrailSnapshot {
  if (mode === "fire_drill") {
    return { ...GUARDRAIL_PRESETS.conservative, source: { preset: "Conservative", reason: "due to Fire Drill mode" } };
  }

  if (mode === "pilot") {
    return { ...GUARDRAIL_PRESETS.conservative, source: { preset: "Conservative", reason: "mode defaults" } };
  }

  if (mode === "sandbox") {
    return { ...GUARDRAIL_PRESETS.exploratory, source: { preset: "Exploratory", reason: "mode defaults" } };
  }

  return { ...GUARDRAIL_PRESETS.balanced, source: { preset: "Balanced", reason: "customized" } };
}

function formatGuardrailPreset(source: GuardrailSource) {
  if (source.preset === "Custom") return `${source.preset} (${source.reason})`;
  return `${source.preset} (${source.reason})`;
}

export default async function OperationsRunbookPage({ params }: { params: { tenantId: string } }) {
  const user = await getCurrentUser();
  const tenantId = params.tenantId?.trim?.() ?? "";

  if (!user || !tenantId) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-xl font-semibold">Admin access required</h1>
          <p className="mt-2 text-sm text-amber-800">You need to be a tenant admin for this workspace to view the runbook.</p>
          <div className="mt-4">
            <Link href="/" className="text-sm font-medium text-amber-900 underline">
              Return to home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const access = await requireTenantAdmin(tenantId, user.id);

  if (!access.isAdmin) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-xl font-semibold">Admin access required</h1>
          <p className="mt-2 text-sm text-amber-800">
            You need to be a tenant admin for this workspace to view the Operations Runbook.
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

  const [currentMode, killSwitches] = await Promise.all([getTenantMode(tenantId), listAgentKillSwitches()]);
  const guardrails = resolveGuardrails(currentMode);
  const killSwitchLookup = new Map(killSwitches.map((switchRow) => [switchRow.agentName, switchRow]));

  const agentRows = AGENTS.map((agent) => {
    const killSwitch = agent.killSwitchName ? killSwitchLookup.get(agent.killSwitchName) : undefined;
    const modeAllows = agent.modeAllows(currentMode);
    const killSwitchEnabled = killSwitch ? !killSwitch.latched : true;

    return {
      ...agent,
      modeAllows,
      killSwitch,
      effective: modeAllows && killSwitchEnabled,
    };
  });

  const fireDrillActive = currentMode === "fire_drill";
  const changeModeHref = `/admin/tenants/${tenantId}`;
  const diagnosticsHref = `/admin/tenant/${tenantId}/diagnostics`;

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <EteLogo variant="horizontal" />
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Admin</p>
              <h1 className="text-3xl font-semibold text-zinc-900">EDGE Talent Engine Operations Runbook</h1>
              <p className="max-w-2xl text-sm text-zinc-600">
                Flight manual for tenant {tenantId} covering system modes, guardrails, agent kill switches, and Fire Drill
                playbook.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link
              href={changeModeHref}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-indigo-200 bg-white px-4 py-2 font-semibold text-indigo-800 shadow-sm transition hover:border-indigo-300 hover:text-indigo-900"
            >
              <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden /> Change Mode
            </Link>
            <Link
              href={diagnosticsHref}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 font-semibold text-amber-900 shadow-sm transition hover:border-amber-300"
            >
              <WrenchScrewdriverIcon className="h-5 w-5" aria-hidden /> Open Diagnostics
            </Link>
          </div>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold text-zinc-900">Overview</h2>
            <p className="text-sm text-zinc-700">
              This Operations Runbook explains how EDGE Talent Engine behaves under different System Modes, how guardrails are
              applied, how agent kill switches work, and how to activate Fire Drill mode during instability.
            </p>
            <div className="grid gap-3 text-sm text-zinc-700 md:grid-cols-3">
              <div className="rounded-xl bg-zinc-50 p-4">Modes determine the personality of the system.</div>
              <div className="rounded-xl bg-zinc-50 p-4">Guardrails determine strictness and thresholds.</div>
              <div className="rounded-xl bg-zinc-50 p-4">Agent kill switches control what functions are available.</div>
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-zinc-900">System Modes</h3>
              <p className="text-sm text-zinc-600">Current mode is highlighted. Use the change mode control to switch.</p>
            </div>
            <div className="rounded-full bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-800">
              Current Mode: {MODE_DEFINITIONS[currentMode].label}
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-zinc-100">
            <table className="min-w-full divide-y divide-zinc-100 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Mode</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Behavior Summary</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">When to Use</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {Object.entries(MODE_DEFINITIONS).map(([mode, details]) => {
                  const isActive = mode === currentMode;
                  return (
                    <tr
                      key={mode}
                      className={
                        isActive
                          ? "bg-indigo-50/70 text-indigo-900"
                          : "bg-white text-zinc-800 hover:bg-zinc-50"
                      }
                    >
                      <td className="px-4 py-3 font-semibold">{details.label}</td>
                      <td className="px-4 py-3">{details.summary}</td>
                      <td className="px-4 py-3">{details.usage}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-zinc-900">Agent Availability</h3>
            <p className="text-sm text-zinc-600">Effective column reflects both mode allowances and kill switch state.</p>
          </div>
          <div className="overflow-hidden rounded-xl border border-zinc-100">
            <table className="min-w-full divide-y divide-zinc-100 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Agent</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Enabled by Mode</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Kill Switch</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Effective</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {agentRows.map((agent) => {
                  const killSwitchState = agent.killSwitch;
                  const killSwitchActiveLabel = killSwitchState?.latched ? "off" : "on";
                  return (
                    <tr key={agent.key} className="bg-white text-zinc-800 hover:bg-zinc-50">
                      <td className="px-4 py-3 font-semibold">{agent.key}</td>
                      <td className="px-4 py-3">{agent.description}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                            agent.modeAllows
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {agent.modeAllows ? "yes" : "no"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                            killSwitchState?.latched ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {killSwitchState ? killSwitchActiveLabel : "on"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                            agent.effective ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {agent.effective ? "yes" : "no"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-700">
            <p>
              If an agent is disabled: This agent is disabled in the current System Mode. To enable it, switch modes or adjust agent
              kill switches.
            </p>
            {fireDrillActive ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                <ExclamationTriangleIcon className="h-5 w-5" aria-hidden />
                <span>Fire Drill mode overrides some agent kill switches to ensure system stability.</span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-zinc-900">Guardrails behavior</h3>
            <p className="text-sm text-zinc-600">Guardrails determine scoring strategy, weighting, thresholds, shortlist behavior, and safety.</p>
          </div>
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-semibold">Guardrails preset: {formatGuardrailPreset(guardrails.source)}</span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-800">
                Strategy: {guardrails.strategy}
              </span>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-700">
              <h4 className="text-sm font-semibold text-zinc-900">Weights</h4>
              <ul className="mt-2 space-y-1">
                <li>Must-have: {guardrails.weights.mustHave}</li>
                <li>Nice-to-have: {guardrails.weights.niceToHave}</li>
                <li>Experience: {guardrails.weights.experience}</li>
                <li>Location: {guardrails.weights.location}</li>
              </ul>
            </div>
            <div className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-700">
              <h4 className="text-sm font-semibold text-zinc-900">Thresholds</h4>
              <ul className="mt-2 space-y-1">
                <li>minMatchScore: {guardrails.thresholds.minMatchScore}</li>
                <li>shortlistMinScore: {guardrails.thresholds.shortlistMinScore}</li>
                <li>shortlistMaxCandidates: {guardrails.thresholds.shortlistMaxCandidates}</li>
              </ul>
            </div>
            <div className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-700">
              <h4 className="text-sm font-semibold text-zinc-900">Explainability</h4>
              <ul className="mt-2 space-y-1">
                <li>Verbosity: {guardrails.explainability.verbosity}</li>
                <li>includeWeights: {guardrails.explainability.includeWeights ? "true" : "false"}</li>
              </ul>
            </div>
            <div className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-700">
              <h4 className="text-sm font-semibold text-zinc-900">Safety</h4>
              <ul className="mt-2 space-y-1">
                <li>requireMustHaves: {guardrails.safety.requireMustHaves ? "true" : "false"}</li>
                <li>excludeInternalCandidates: {guardrails.safety.excludeInternalCandidates ? "true" : "false"}</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FireIcon className="h-6 w-6 text-amber-500" aria-hidden />
              <h3 className="text-lg font-semibold text-zinc-900">Fire Drill Mode Playbook</h3>
            </div>
            <p className="text-sm text-zinc-600">
              Fire Drill mode is designed for system instability conditions. Use these break-glass steps to keep the platform stable.
            </p>
          </div>
          <div
            className={`rounded-xl border p-4 text-sm ${
              fireDrillActive
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-amber-100 bg-white text-zinc-800"
            }`}
          >
            <ul className="list-disc space-y-2 pl-5">
              <li>EXPLAIN and CONFIDENCE are forcibly disabled.</li>
              <li>MATCH and SHORTLIST use deterministic scoring with no LLM dependencies.</li>
              <li>Guardrails switch to the conservative preset.</li>
              <li>Only essential agents remain enabled (RUA, RINA, MATCH, SHORTLIST).</li>
              <li>The entire system operates in stability-first mode.</li>
            </ul>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldExclamationIcon className="h-5 w-5" aria-hidden /> When should you activate Fire Drill?
              </div>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                <li>Frequent 500 errors from LLM provider</li>
                <li>EXPLAIN/CONFIDENCE failures above threshold</li>
                <li>Incorrect or inconsistent match output</li>
                <li>Vendor outages or rate-limiting</li>
                <li>During critical demos where stability matters more than accuracy</li>
              </ul>
            </div>
            <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <div className="flex items-center gap-2 font-semibold">
                <WrenchScrewdriverIcon className="h-5 w-5" aria-hidden /> How to exit Fire Drill
              </div>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                <li>Switch mode back to Production or Pilot</li>
                <li>Verify Diagnostics is green across: Agents, Scoring Engine, Guardrails, DB health</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
