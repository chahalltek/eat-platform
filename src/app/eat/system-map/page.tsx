import { ClientActionLink } from "@/components/ClientActionLink";
import { EATClientLayout } from "@/components/EATClientLayout";
import { StatusPill } from "@/components/StatusPill";

const flowStages = [
  {
    name: "Intake",
    agent: "RUA / INTAKE",
    responsibility: "Normalize the role into structured requirements.",
    inputs: "Job description",
    outputs: "Role profile with skills, seniority, and constraints",
  },
  {
    name: "Profile",
    agent: "RINA / PROFILE",
    responsibility: "Standardize candidate data into comparable profiles.",
    inputs: "Resumes, parsed histories",
    outputs: "Structured candidate profile with normalized titles and skills",
  },
  {
    name: "Match",
    agent: "MATCHER",
    responsibility: "Score candidates against the role profile.",
    inputs: "Role profile + candidate profiles",
    outputs: "Ranked candidate matches",
  },
  {
    name: "Confidence",
    agent: "CONFIDENCE",
    responsibility: "Validate data quality and surface risks before decisions.",
    inputs: "Match results + profile health signals",
    outputs: "Quality flags and confidence score",
  },
  {
    name: "Explain",
    agent: "EXPLAIN",
    responsibility: "Turn scores and evidence into clear reasoning.",
    inputs: "Matches + confidence findings",
    outputs: "Human-readable rationales for each candidate",
  },
  {
    name: "Shortlist",
    agent: "SHORTLIST",
    responsibility: "Select the candidates to move forward.",
    inputs: "Explain output + confidence gates",
    outputs: "Submit-ready shortlist with justification",
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
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-indigo-600 dark:text-indigo-400">SYSTEM MAP</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">EAT Data Flow</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Concrete view of how agents hand off structured data from intake to shortlist. No marketing, just the pipeline and
            its boundaries.
          </p>
        </div>
        <ClientActionLink href="/">Back to home</ClientActionLink>
      </div>

      <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Agent pipeline</h2>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Diagram</p>
        </div>
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max items-stretch gap-4">
            {flowStages.map((stage, index) => (
              <div key={stage.name} className="flex items-center gap-3">
                <div className="w-64 space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-950">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{stage.name}</p>
                    <span className="rounded-full bg-zinc-200 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                      {stage.agent}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">{stage.responsibility}</p>
                  <div className="space-y-1 rounded-lg bg-white p-3 text-xs text-zinc-600 shadow-sm dark:bg-black/40 dark:text-zinc-300">
                    <p>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-100">Input:</span> {stage.inputs}
                    </p>
                    <p>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-100">Output:</span> {stage.outputs}
                    </p>
                  </div>
                </div>
                {index < flowStages.length - 1 ? (
                  <div className="flex h-full items-center">
                    <span className="text-lg font-semibold text-zinc-500">→</span>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-2">
          <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Data flow</h3>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>Job descriptions enter through RUA and become role profiles before any matching is allowed.</li>
            <li>Candidate resumes are normalized by RINA; downstream agents consume the normalized profile, not the raw file.</li>
            <li>MATCHER only runs when both role and candidate profiles exist; results are immutable inputs to Confidence.</li>
            <li>Confidence gates prevent Explain and Shortlist from using stale or low-quality matches.</li>
            <li>Shortlist output is the only place candidates advance; it always cites the Explain reasoning that led to it.</li>
          </ul>
        </div>

        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Status grammar</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Colors communicate state without relying on labels.</p>
          <div className="space-y-2">
            {statusLegend.map((item) => (
              <div key={item.status} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{item.label}</span>
                <StatusPill status={item.status} label={item.label} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Dependencies</h3>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>Database is the source of truth for roles, candidates, and run logs; if unavailable, matching halts.</li>
            <li>Feature flags control access to Agents and Scoring; a disabled flag blocks the dependent agent call.</li>
            <li>Scoring pipeline expects structured profiles; malformed data fails fast rather than auto-correcting.</li>
            <li>Tenant configuration determines which subsystems appear on the home grid and in the status panel.</li>
          </ul>
        </div>

        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Ownership boundaries</h3>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>UI collects inputs and surfaces results; it never rewrites agent outputs.</li>
            <li>Agents own interpretation: RUA/RINA create profiles, MATCHER scores, CONFIDENCE gates quality, EXPLAIN justifies, SHORTLIST decides.</li>
            <li>Data correctness checks live in Confidence; Explain and Shortlist consume its signals instead of revalidating.</li>
            <li>System Status reflects real subsystem health (agents, scoring, database, tenant config) pulled at request time.</li>
          </ul>
        </div>
      </section>
    </EATClientLayout>
  );
}
