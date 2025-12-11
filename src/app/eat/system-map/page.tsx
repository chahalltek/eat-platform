import { ClientActionLink } from "@/components/ClientActionLink";
import { EATClientLayout } from "@/components/EATClientLayout";
import { StatusPill } from "@/components/StatusPill";

const systemNodes = [
  {
    id: "intake",
    name: "Intake",
    type: "Entry",
    summary: "Jobs and resumes enter the system before any automation runs.",
    tags: ["Hiring manager inputs", "Resume uploads"],
  },
  {
    id: "rua",
    name: "RUA",
    type: "Agent",
    summary: "Converts job descriptions into structured role profiles.",
    tags: ["Role normalization", "Guardrails applied"],
  },
  {
    id: "rina",
    name: "RINA",
    type: "Agent",
    summary: "Standardizes resumes into candidate profiles with comparable fields.",
    tags: ["Resume parsing", "Title normalization"],
  },
  {
    id: "scoring",
    name: "Scoring engine",
    type: "Engine",
    summary: "Ranks candidates against the role using job library context and weights.",
    tags: ["Matcher", "Job library"],
  },
  {
    id: "confidence",
    name: "Confidence / Explain",
    type: "Reasoning",
    summary: "Checks data quality, then produces rationales that cite evidence.",
    tags: ["Quality gates", "Narratives"],
  },
  {
    id: "database",
    name: "Database",
    type: "Data",
    summary: "System of record for profiles, scores, and audit logs.",
    tags: ["Job library", "Run history"],
  },
  {
    id: "tenant",
    name: "Tenant Config",
    type: "Config",
    summary: "Feature flags, thresholds, and experience toggles per tenant.",
    tags: ["Feature flags", "Weights"],
  },
] as const;

const flowSequences = [
  {
    label: "Role flow",
    steps: ["Intake", "RUA", "Database"],
    note: "Role is stored and later used by matching and scoring agents.",
  },
  {
    label: "Resume flow",
    steps: ["Intake", "RINA", "Database", "Scoring engine", "Confidence / Explain"],
  },
  {
    label: "Scoring flow",
    steps: [
      "Role + Candidates",
      "MATCH",
      "Scoring engine",
      "Confidence / Explain",
      "Database (results)",
    ],
    note: "Uses roles from RUA and candidates from RINA / PROFILE to rank matches.",
  },
  {
    label: "Guardrails",
    steps: ["Tenant Config", "Scoring engine", "Confidence / Explain"],
  },
] as const;

const statusLegend = [
  { status: "healthy" as const, label: "Healthy" },
  { status: "enabled" as const, label: "Idle" },
  { status: "warning" as const, label: "Waiting" },
  { status: "error" as const, label: "Fault" },
  { status: "off" as const, label: "Disabled" },
];

export default function SystemMapPage() {
  return (
    <EATClientLayout maxWidthClassName="max-w-6xl" contentClassName="space-y-10">
      <section className="overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-6 shadow-sm dark:border-indigo-900/40 dark:from-indigo-950/60 dark:via-zinc-950 dark:to-emerald-950/40">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">System Map</p>
            <h1 className="text-4xl font-semibold leading-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">EAT data flow blueprint</h1>
            <p className="max-w-3xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
              How agents, scoring, and configuration hand off work. Open this when you need the blueprint for dependencies, not just a link.
            </p>
          </div>
          <ClientActionLink href="/">Back to Console</ClientActionLink>
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Blueprint</p>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Nodes and directional flows</h2>
        </div>

        <div className="grid gap-4">
          <div className="space-y-4 rounded-2xl border border-indigo-100/60 bg-gradient-to-b from-white to-indigo-50/60 p-4 dark:border-indigo-800/50 dark:from-zinc-900 dark:to-indigo-950/30">
            <div className="space-y-3">
              {flowSequences.map((sequence) => (
                <div key={sequence.label} className="space-y-1">
                  <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-sm font-semibold text-indigo-800 ring-1 ring-indigo-100 backdrop-blur dark:bg-zinc-900/70 dark:text-indigo-100 dark:ring-indigo-800/60">
                    <span className="mr-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] uppercase tracking-[0.14em] text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200">
                      {sequence.label}
                    </span>
                    {sequence.steps.map((step, index) => (
                      <div key={step} className="flex items-center gap-2">
                        <FlowPill label={step} />
                        {index < sequence.steps.length - 1 ? <FlowArrow /> : null}
                      </div>
                    ))}
                  </div>
                  {sequence.note ? (
                    <p className="text-center text-xs font-medium text-indigo-800/80 dark:text-indigo-100/80">
                      {sequence.note}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {systemNodes.map((node) => (
                <div key={node.id} className="space-y-3 rounded-2xl border border-indigo-100 bg-white/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-indigo-800 dark:bg-zinc-900/80">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">{node.type}</p>
                      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{node.name}</h3>
                    </div>
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-900/50 dark:text-indigo-200 dark:ring-indigo-700/50">
                      Node
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{node.summary}</p>
                  <div className="flex flex-wrap gap-2">
                    {node.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-200 dark:ring-indigo-800/60">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 rounded-2xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70 lg:col-span-2">
          <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Data flow highlights</h3>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>Job descriptions land in Intake and flow through RUA before any scoring is permitted.</li>
            <li>Resumes move Intake → RINA → Database (Job Library) → Scoring engine; downstream agents only touch normalized profiles.</li>
            <li>Scoring engine requires both role and candidate profiles; outputs are immutable inputs to Confidence / Explain.</li>
            <li>Confidence / Explain block bad data and record rationales alongside scores for auditability.</li>
            <li>Tenant Config injects feature flags and weighting rules; if disabled, dependent steps halt instead of falling back.</li>
          </ul>
        </div>

        <div className="space-y-3 rounded-2xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70">
          <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Status grammar</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Colors communicate state without relying on labels.</p>
          <div className="space-y-2">
            {statusLegend.map((item) => (
              <div key={item.status} className="flex items-center justify-between rounded-lg border border-indigo-100 bg-white/80 px-3 py-2 dark:border-indigo-800 dark:bg-zinc-950/60">
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{item.label}</span>
                <StatusPill status={item.status} label={item.label} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70">
          <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Dependencies</h3>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>Database / Job Library is the source of truth for roles, candidates, and scoring history; if unavailable, matching halts.</li>
            <li>Feature flags from Tenant Config control access to agents and scoring; a disabled flag blocks the dependent agent call.</li>
            <li>Scoring pipeline expects structured profiles; malformed data fails fast rather than auto-correcting.</li>
            <li>Blueprint view mirrors the dashboard header style to reinforce that this is part of the core control plane.</li>
          </ul>
        </div>

        <div className="space-y-3 rounded-2xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70">
          <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Ownership boundaries</h3>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>UI collects inputs and surfaces results; it never rewrites agent outputs.</li>
            <li>Agents own interpretation: RUA shapes roles, RINA normalizes resumes, Scoring engine ranks, Confidence / Explain gate quality.</li>
            <li>Data correctness checks live in Confidence / Explain; downstream consumers reuse those signals instead of revalidating.</li>
            <li>System Status pulls live subsystem health (agents, scoring, database, tenant config) and aligns with this blueprint.</li>
          </ul>
        </div>
      </section>
    </EATClientLayout>
  );
}

function FlowPill({ label }: { label: string }) {
  return (
    <span className="flex items-start gap-2 rounded-full bg-indigo-50 px-3 py-1 text-left text-[13px] font-semibold leading-snug text-indigo-800 ring-1 ring-indigo-100 dark:bg-indigo-900/60 dark:text-indigo-100 dark:ring-indigo-700/60">
      <span className="mt-1 h-2 w-2 rounded-full bg-indigo-500" aria-hidden />
      <span className="whitespace-normal">{label}</span>
    </span>
  );
}

function FlowArrow() {
  return (
    <span className="text-base font-semibold text-indigo-500 dark:text-indigo-200" aria-hidden>
      →
    </span>
  );
}
