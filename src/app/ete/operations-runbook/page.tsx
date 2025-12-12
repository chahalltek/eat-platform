import { ClientActionLink } from "@/components/ClientActionLink";
import { ETEClientLayout } from "@/components/ETEClientLayout";
import { StatusPill } from "@/components/StatusPill";

const modes = [
  {
    id: "pilot",
    label: "Pilot",
    summary: "Tight guardrails and focused agents for controlled rollouts.",
    whenToUse: ["First tenant launches", "High-touch onboarding", "Validating data quality"],
  },
  {
    id: "production",
    label: "Production",
    summary: "Full system posture with balanced guardrails and all agents enabled.",
    whenToUse: ["Day-to-day operations", "Stable tenants", "Running hiring cycles"],
  },
  {
    id: "sandbox",
    label: "Sandbox",
    summary: "Exploratory stance with looser thresholds to see more variation.",
    whenToUse: ["Demos and experiments", "Tuning prompts or scoring", "Collecting feedback"],
  },
  {
    id: "fire_drill",
    label: "Fire Drill",
    summary: "Break-glass mode that prioritizes stability over completeness.",
    whenToUse: ["Upstream LLM instability", "Vendor outages or 500s", "Stability-first demos"],
  },
] as const;

const guardrailSignals = [
  {
    title: "Scoring + thresholds",
    items: [
      "Weights for must-have vs. nice-to-have signals",
      "Minimum match score and shortlist cutoffs",
      "Shortlist size limits to prevent noisy output",
    ],
  },
  {
    title: "Explainability",
    items: [
      "Verbosity level for rationales",
      "Whether to show weight contributions",
      "Evidence expectations for claims",
    ],
  },
  {
    title: "Safety",
    items: [
      "Require must-have skills before ranking",
      "Excluding internal candidates when requested",
      "Blocking incomplete or low-confidence runs",
    ],
  },
];

const agentSwitches = [
  {
    agent: "RUA",
    role: "Job intake",
    note: "Controls whether new role definitions enter the system.",
  },
  {
    agent: "RINA",
    role: "Resume ingestion",
    note: "Standardizes resumes before scoring.",
  },
  {
    agent: "MATCH",
    role: "Scoring engine",
    note: "Core ranking logic; rarely disabled except during outages.",
  },
  {
    agent: "CONFIDENCE",
    role: "Quality gates",
    note: "Applies banding and data quality checks before surfacing results.",
  },
  {
    agent: "EXPLAIN",
    role: "Narratives",
    note: "Adds rationales and evidence; paused in Fire Drill.",
  },
  {
    agent: "SHORTLIST",
    role: "Candidate curation",
    note: "Shapes final shortlist size and ordering.",
  },
];

const fireDrillSteps = [
  "Pause EXPLAIN and CONFIDENCE to eliminate LLM dependencies.",
  "Force conservative guardrails and deterministic scoring.",
  "Keep RUA, RINA, MATCH, and SHORTLIST on to preserve core flows.",
  "Communicate to stakeholders that stability-first mode is active.",
];

const fireDrillTriggers = [
  "Sustained LLM 500s or vendor rate limits",
  "Spike in EXPLAIN or CONFIDENCE failures",
  "Scoring outputs look incorrect or inconsistent",
  "Critical demo where reliability matters more than feature depth",
];

export default function OperationsRunbookPage() {
  return (
    <ETEClientLayout maxWidthClassName="max-w-6xl" contentClassName="space-y-8">
      <section className="overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-6 shadow-sm dark:border-indigo-900/40 dark:from-indigo-950/60 dark:via-zinc-950 dark:to-emerald-950/40">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Runbook</p>
            <h1 className="text-4xl font-semibold leading-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
              Operations Runbook: Modes & Guardrails
            </h1>
            <p className="max-w-3xl text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
              Read-only reference for admins. Use this as the single source for how system modes, guardrails, and agent kill switches
              work together, plus when to trigger Fire Drill.
            </p>
          </div>
          <ClientActionLink href="/">Back to Console</ClientActionLink>
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">System Modes</p>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Mode behaviors and recommended use</h2>
          </div>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-800 ring-1 ring-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-100 dark:ring-indigo-800/60">
            Read-only
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-indigo-100/70 bg-white/60 shadow-sm dark:border-indigo-800/60 dark:bg-zinc-950/40">
          <table className="min-w-full divide-y divide-indigo-100 text-sm">
            <thead className="bg-indigo-50/80 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em]">Mode</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em]">Behavior</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em]">When to use</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-100/80 dark:divide-indigo-800/60">
              {modes.map((mode) => (
                <tr key={mode.id} className="bg-white/70 text-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-100">
                  <td className="px-4 py-3 font-semibold text-indigo-900 dark:text-indigo-100">{mode.label}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-200">{mode.summary}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-200">
                    <ul className="list-disc space-y-1 pl-4">
                      {mode.whenToUse.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-indigo-50/70 p-4 text-sm text-indigo-900 dark:bg-indigo-900/50 dark:text-indigo-100">
            <p className="font-semibold">Pilot</p>
            <p className="mt-1 text-indigo-900/80 dark:text-indigo-100/80">Conservative guardrails and only essential agents.</p>
          </div>
          <div className="rounded-2xl bg-emerald-50/80 p-4 text-sm text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100">
            <p className="font-semibold">Production</p>
            <p className="mt-1 text-emerald-900/80 dark:text-emerald-100/80">Balanced guardrails with full feature set enabled.</p>
          </div>
          <div className="rounded-2xl bg-amber-50/70 p-4 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
            <p className="font-semibold">Sandbox</p>
            <p className="mt-1 text-amber-900/80 dark:text-amber-100/80">Looser thresholds so you can see variability and experiment.</p>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Guardrails</p>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">What guardrails control</h2>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            Guardrails set the posture for scoring and messaging. Modes choose a preset, but runbook readers should know what each
            dimension covers.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {guardrailSignals.map((signal) => (
            <div key={signal.title} className="rounded-2xl border border-indigo-100 bg-white/70 p-4 shadow-sm dark:border-indigo-800/60 dark:bg-zinc-900/60">
              <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">{signal.title}</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-zinc-700 dark:text-zinc-200">
                {signal.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="rounded-2xl bg-indigo-50/70 p-4 text-sm text-indigo-900 ring-1 ring-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-100 dark:ring-indigo-800/60">
          <p className="font-semibold">Preset mapping</p>
          <p className="mt-1 text-indigo-900/80 dark:text-indigo-100/80">
            Pilot and Fire Drill force conservative guardrails. Production uses balanced defaults. Sandbox leans exploratory and may
            expand shortlist size and allow softer safety checks.
          </p>
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Agent Kill Switches</p>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">What stays on when things wobble</h2>
            <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">Each agent can be paused individually to keep lights on.</p>
          </div>
          <StatusPill status="warning" label="Read-only" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {agentSwitches.map((agent) => (
            <div key={agent.agent} className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-white/70 p-4 shadow-sm dark:border-indigo-800/60 dark:bg-zinc-900/60">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-sm font-semibold text-indigo-800 ring-1 ring-indigo-100 dark:bg-indigo-900/50 dark:text-indigo-100 dark:ring-indigo-800/60">
                {agent.agent}
              </div>
              <div className="space-y-1 text-sm text-zinc-700 dark:text-zinc-200">
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">{agent.role}</p>
                <p>{agent.note}</p>
                <p className="text-xs text-indigo-700 dark:text-indigo-200">Mode dependent: Fire Drill automatically pauses EXPLAIN and CONFIDENCE.</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 rounded-3xl border border-amber-200 bg-amber-50/90 p-6 shadow-sm dark:border-amber-700/70 dark:bg-amber-950/40 md:grid-cols-2">
        <div className="space-y-3 text-amber-900 dark:text-amber-100">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-800 ring-1 ring-amber-200 dark:bg-amber-900/60 dark:text-amber-100 dark:ring-amber-700/70">
              Fire Drill
            </span>
            <h3 className="text-xl font-semibold">When to activate</h3>
          </div>
          <p className="text-sm text-amber-900/90 dark:text-amber-100/80">Use Fire Drill when stability is at risk.</p>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            {fireDrillTriggers.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-emerald-900 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-900/50 dark:text-emerald-100">
          <h3 className="text-lg font-semibold">What happens in Fire Drill</h3>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
            {fireDrillSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
          <p className="text-sm text-emerald-900/80 dark:text-emerald-100/80">
            Exit by returning to Production or Pilot after diagnostics show agents, scoring, and guardrails are healthy.
          </p>
        </div>
      </section>
    </ETEClientLayout>
  );
}
