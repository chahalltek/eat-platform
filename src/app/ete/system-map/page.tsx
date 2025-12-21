import fs from "node:fs";
import path from "node:path";

import { ClientActionLink } from "@/components/ClientActionLink";
import { ETEClientLayout } from "@/components/ETEClientLayout";
import { StatusPill } from "@/components/StatusPill";

function getDocLastUpdated(docPath: string): { lastUpdatedIso: string } | null {
  if (!fs.existsSync(docPath)) {
    return null;
  }

  const stats = fs.statSync(docPath);

  return { lastUpdatedIso: stats.mtime.toISOString() };
}

function formatDate(value: string | null) {
  if (!value) return "Unknown";

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) return "Unknown";

  const formattedDate = parsedDate.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return formattedDate.toUpperCase();
}

function getLatestIsoDate(...values: Array<string | null | undefined>) {
  const timestamps = values
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter((timestamp) => !Number.isNaN(timestamp));

  if (timestamps.length === 0) return null;

  return new Date(Math.max(...timestamps)).toISOString();
}

const systemNodes = [
  {
    id: "intake",
    name: "Intake",
    type: "Entry",
    summary: "Jobs and resumes enter the system before any automation runs.",
    tags: ["Hiring manager inputs", "Resume uploads"],
  },
  {
    id: "ats",
    name: "ATS / Integrations",
    type: "Adapter",
    summary: "Optionally syncs jobs and candidates from external systems into Intake and the database.",
    tags: ["Optional", "Sync"],
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
    id: "adapter",
    name: "ATS Adapter / Sync",
    type: "Integration",
    summary: "Ingests ATS jobs and candidates, then keeps them synchronized.",
    tags: ["API ingress", "Webhook sync"],
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
    id: "agent-sync",
    name: "Agent Sync / Expand",
    type: "Coordination",
    summary: "Synchronizes agent runs and expands workloads across downstream steps.",
    tags: ["Fan-out", "Scheduling"],
  },
  {
    id: "database",
    name: "Database",
    type: "Data",
    summary: "System of record for profiles, scores, and audit logs.",
    tags: ["Job library", "Run history"],
  },
  {
    id: "diagnostics",
    name: "Diagnostics / Audit log",
    type: "Observability",
    summary: "Traces agent calls, inputs, and outcomes for troubleshooting.",
    tags: ["Audit trail", "Metrics"],
  },
  {
    id: "tenant-config",
    name: "Tenant Config",
    type: "Control plane",
    summary: "Thresholds, presets, and tuning per tenant.",
    tags: ["Weights", "LLM config", "Presets"],
  },
  {
    id: "feature-flags",
    name: "Feature Flags",
    type: "Control plane",
    summary: "Gates agent combinations and UI surface safety.",
    tags: ["Access gates", "UI safety"],
  },
  {
    id: "runtime-controls",
    name: "Runtime Controls",
    type: "Control plane",
    summary: "Modes and safety latches that fail closed and log why.",
    tags: ["Pilot mode", "Kill switch", "Fire drill"],
  },
] as const;

const flowSequences = [
  {
    label: "Role flow",
    steps: ["Intake (RUA)", "Normalize", "Role profile"],
    note: "Role is stored and later used by matching and scoring agents.",
  },
  {
    label: "ATS / Integrations",
    steps: ["ATS / Integrations", "Jobs / Candidates", "Database", "Agents"],
    note: "Optional lane; resume uploads and manual intake remain valid entry points.",
  },
  {
    label: "Resume flow",
    steps: ["Profile (RINA)", "Normalize", "Database (results)", "Scoring engine", "Confidence / Explain"],
  },
  {
    label: "Scoring flow",
    steps: ["Role + Candidates", "Shortlist", "Database (results)", "Confidence / Explain"],
    note: "Uses roles from RUA and candidates from RINA / PROFILE to rank matches.",
  },
  {
    label: "OPS flow",
    steps: ["Agent endpoints", "Agent log + Audit", "Diagnostics UI"],
    note: "Debug agent runs with linked inputs, outputs, and traces.",
  },
  {
    label: "ATS flow",
    steps: ["ATS Adapter / Sync", "Jobs + Candidates", "Database", "Downstream agents"],
    arrowVariant: "dashed",
  },
  {
    label: "Guardrails",
    steps: [
      "Tenant Config",
      "Feature Flags",
      "Runtime Controls",
      "Scoring engine",
      "Confidence / Explain",
    ],
    subtitles: ["thresholds", "gates", "failsafe", "calculations", "interpretation"],
    arrowVariant: "dashed",
  },
] satisfies {
  label: string;
  steps: readonly string[];
  subtitles?: readonly string[];
  arrowVariant?: "solid" | "dashed";
  note?: string;
  }[];

const statusLegend = [
  { status: "healthy" as const, label: "Healthy" },
  { status: "enabled" as const, label: "Idle" },
  { status: "warning" as const, label: "Waiting" },
  { status: "error" as const, label: "Fault" },
  { status: "off" as const, label: "Disabled" },
];

const apiMapDocPath = path.join(process.cwd(), "docs/architecture/api-map.md");
const apiMapDocUrl = "https://github.com/edgeandnode/ete-platform/blob/main/docs/architecture/api-map.md";

const apiMapFallbackLastUpdatedIso = "2025-12-20T00:00:00.000Z";
const apiMapDocMetadata = getDocLastUpdated(apiMapDocPath);
const apiMapLastUpdatedIso = getLatestIsoDate(apiMapFallbackLastUpdatedIso, apiMapDocMetadata?.lastUpdatedIso) ?? apiMapFallbackLastUpdatedIso;
const apiMapLastUpdatedDisplay = formatDate(apiMapLastUpdatedIso);

const apiSurface = [
  {
    label: "Agent APIs",
    path: "/api/agents/*",
    context: "and job-scoped routes (matcher)",
  },
  {
    label: "Admin APIs",
    path: "/api/admin/*",
    context: "",
  },
  {
    label: "Tenant Ops APIs",
    path: "/api/tenant/*",
    context: "",
  },
] as const;

export default function SystemMapPage() {
  return (
    <ETEClientLayout maxWidthClassName="max-w-6xl" contentClassName="space-y-10">
      <section className="overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-6 shadow-sm dark:border-indigo-900/40 dark:from-indigo-950/60 dark:via-zinc-950 dark:to-emerald-950/40">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">System Map</p>
            <h1 className="text-4xl font-semibold leading-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">EDGE Talent Engine data flow blueprint</h1>
            <p className="max-w-3xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
              How agents, engines, and control-plane configuration hand off work. Use this as a system-of-truth blueprint for dependencies, guardrails, and failure modes — not as user documentation.
            </p>
            <div className="mt-1 rounded-xl border border-indigo-100 bg-white/80 p-3 text-sm leading-relaxed text-indigo-900 shadow-sm dark:border-indigo-800/60 dark:bg-zinc-900/80 dark:text-indigo-100/80">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700 dark:text-indigo-300">Why this matters</p>
              <p className="mt-1 text-indigo-900/80 dark:text-indigo-100/80">
                This blueprint makes it possible to understand where judgment happens, where automation stops, and how risk is controlled — without relying on individual knowledge or tribal memory.
              </p>
            </div>
          </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700 ring-1 ring-indigo-100 dark:bg-zinc-900/70 dark:text-indigo-200 dark:ring-indigo-800/60">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
              <span>
                Last updated: <time dateTime={apiMapLastUpdatedIso ?? undefined}>{apiMapLastUpdatedDisplay}</time>
              </span>
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <ClientActionLink href={apiMapDocUrl}>View API Map</ClientActionLink>
              <ClientActionLink href="/">Back to Console</ClientActionLink>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-3xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Orientation</p>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">How to read this page</h2>
        </div>
        <div className="space-y-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          <p>This page is a system-of-truth blueprint for how ETE works internally.</p>
          <p>It is not user documentation and not a step-by-step workflow. Use it to understand:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Where judgment happens vs. execution</li>
            <li>Which components depend on which inputs</li>
            <li>How failures propagate and fail closed</li>
            <li>Which controls can change behavior without redeploying agents</li>
          </ul>
          <p>Flows shown here run at intentional decision moments, not continuously.</p>
        </div>
      </section>

      <section className="grid gap-3 rounded-3xl border border-indigo-100/70 bg-white/80 p-5 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70 md:grid-cols-[1.1fr_2fr]">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">API Surface</p>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Where these calls live (non-exhaustive)</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Quick pointers so you know where to look without turning this into an endpoint catalog.
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            These routes exist to support agent execution and control-plane operations, not as a public API contract.
          </p>
        </div>
        <ul className="grid gap-2 rounded-2xl border border-indigo-100 bg-white/80 p-4 text-sm leading-relaxed text-zinc-700 shadow-sm dark:border-indigo-800 dark:bg-zinc-950/60 dark:text-zinc-200 sm:grid-cols-2">
          {apiSurface.map((item) => (
            <li key={item.label} className="flex flex-col gap-1 rounded-xl bg-indigo-50/60 p-3 ring-1 ring-indigo-100 dark:bg-indigo-900/30 dark:ring-indigo-800/60">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700 dark:text-indigo-200">{item.label}</span>
              <span className="font-mono text-[13px] font-semibold text-indigo-900 dark:text-indigo-100">{item.path}</span>
              {item.context ? (
                <span className="text-xs text-indigo-900/80 dark:text-indigo-100/80">{item.context}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4 rounded-3xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Blueprint</p>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Nodes and directional flows</h2>
        </div>

<<<<<<< ours
        <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          These flows are executed at intentional decision moments. Not every flow runs for every action.
        </p>
=======
        <div className="rounded-xl border border-indigo-100 bg-white/80 p-3 text-sm leading-relaxed text-indigo-900 shadow-sm dark:border-indigo-800/60 dark:bg-zinc-900/80 dark:text-indigo-100/80">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700 dark:text-indigo-300">Why this matters</p>
          <p className="mt-1 text-indigo-900/80 dark:text-indigo-100/80">
            Knowing which components reason versus which simply execute prevents over-automation and makes it clear where human accountability must remain.
          </p>
        </div>
>>>>>>> theirs

        <div className="grid gap-4">
          <div className="space-y-4 rounded-2xl border border-indigo-100/60 bg-gradient-to-b from-white to-indigo-50/60 p-4 dark:border-indigo-800/50 dark:from-zinc-900 dark:to-indigo-950/30">
            <div className="space-y-3">
              {flowSequences.map((sequence) => (
                <div key={sequence.label} className="space-y-1">
                  <div className="flex w-full flex-wrap items-start justify-start gap-2 rounded-xl bg-white/70 px-3 py-2 text-sm font-semibold text-indigo-800 ring-1 ring-indigo-100 backdrop-blur dark:bg-zinc-900/70 dark:text-indigo-100 dark:ring-indigo-800/60">
                    <span className="mr-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] uppercase tracking-[0.14em] text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200">
                      {sequence.label}
                    </span>
                    {sequence.steps.map((step, index) => (
                      <div key={step} className="flex items-start gap-2">
                        <FlowPill label={step} subtitle={sequence.subtitles?.[index]} />
                        {index < sequence.steps.length - 1 ? (
                          <FlowArrow variant={sequence.arrowVariant} />
                        ) : null}
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

            <div className="space-y-2 rounded-2xl border border-dashed border-indigo-200 bg-white/70 p-4 text-sm leading-relaxed text-zinc-700 dark:border-indigo-800 dark:bg-zinc-900/60 dark:text-zinc-200">
              <p className="font-semibold text-zinc-900 dark:text-zinc-50">Node type legend:</p>
              <ul className="grid gap-1 sm:grid-cols-2">
                <li>• Agent = reasoning and judgment</li>
                <li>• Engine = deterministic scoring or computation</li>
                <li>• Adapter = system ingress and egress</li>
                <li>• Control Plane = configuration, gating, and safety</li>
                <li>• Data = system of record</li>
              </ul>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {systemNodes.map((node) => (
                <div
                  key={node.id}
                  className="flex h-full flex-col gap-3 rounded-2xl border border-indigo-100 bg-white/90 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-indigo-800 dark:bg-zinc-900/80"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">{node.type}</p>
                      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{node.name}</h3>
                    </div>
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-900/50 dark:text-indigo-200 dark:ring-indigo-700/50">
                      Node
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-zinc-700 line-clamp-3 dark:text-zinc-300">{node.summary}</p>
                  {node.id === "confidence" ? (
                    <div className="rounded-lg border border-indigo-100 bg-indigo-50/70 p-3 text-xs leading-relaxed text-indigo-900 dark:border-indigo-800/60 dark:bg-indigo-900/40 dark:text-indigo-100/80">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-700 dark:text-indigo-300">Why this matters</p>
                      <p className="mt-1 text-indigo-900/80 dark:text-indigo-100/80">
                        This is where decisions become explainable, defensible, and auditable — turning outcomes into durable organizational memory.
                      </p>
                    </div>
                  ) : null}
                  <div className="mt-auto flex flex-wrap gap-2">
                    {node.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-200 dark:ring-indigo-800/60"
                      >
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

      <section className="space-y-3 rounded-3xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Control plane</p>
          <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">How we tune, gate, and shut off flows</h3>
          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            The control plane separates judgment and execution from configuration so behavior can be changed without redeploying agents or rewriting history. These controls back the GUARDRAILS flow above.
          </p>
          <div className="rounded-xl border border-indigo-100 bg-white/80 p-3 text-sm leading-relaxed text-indigo-900 shadow-sm dark:border-indigo-800/60 dark:bg-zinc-900/80 dark:text-indigo-100/80">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700 dark:text-indigo-300">Why this matters</p>
            <p className="mt-1 text-indigo-900/80 dark:text-indigo-100/80">
              Separating control from execution allows leadership to change behavior safely, respond to risk, and enforce policy without redeploying code or re-litigating past decisions.
            </p>
          </div>
        </div>

        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          <li>
            <strong className="text-zinc-900 dark:text-zinc-100">Tenant Config.</strong> Thresholds, presets, and tuning per tenant.
          </li>
          <li>
            <strong className="text-zinc-900 dark:text-zinc-100">Feature Flags.</strong> Gates agent combinations and UI surface safety.
          </li>
          <li>
            <strong className="text-zinc-900 dark:text-zinc-100">Runtime Controls.</strong> Modes and safety latches that fail closed and log why.
          </li>
        </ul>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 rounded-2xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70 lg:col-span-2">
          <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Data flow highlights</h3>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>
              ATS adapters sync jobs and candidates when connected; resume uploads and manual intake remain alternate entry
              points.
            </li>
            <li>Job descriptions land in Intake and flow through RUA before any scoring is permitted.</li>
            <li>Resumes move Intake → RINA → Database (Job Library) → Scoring engine; downstream agents only touch normalized profiles.</li>
            <li>Scoring engine requires both role and candidate profiles; outputs are immutable inputs to Confidence / Explain.</li>
            <li>Confidence / Explain block bad data and record rationales alongside scores for auditability.</li>
            <li>Tenant Config injects feature flags and weighting rules; if disabled, dependent steps halt instead of falling back.</li>
            <li>Runtime Controls + Feature Flags gate execution; disabled features fail closed and log why.</li>
            <li>Control plane feeds thresholds, flags, and runtime latches; dependent steps halt instead of falling back when controls disable them.</li>
            <li>Agent runs emit structured run logs and audit events (success/failure + rationale).</li>
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

      <section className="space-y-3 rounded-3xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Diagnostics</p>
          <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Diagnostics / Audit log</h3>
          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            Trace every agent call, input, and outcome with context so troubleshooting connects back to the exact decision path.
          </p>
          <div className="rounded-xl border border-indigo-100 bg-white/80 p-3 text-sm leading-relaxed text-indigo-900 shadow-sm dark:border-indigo-800/60 dark:bg-zinc-900/80 dark:text-indigo-100/80">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700 dark:text-indigo-300">Why this matters</p>
            <p className="mt-1 text-indigo-900/80 dark:text-indigo-100/80">
              When something goes wrong, this is how the system explains what happened, why it happened, and whether it should happen again.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70">
          <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Dependencies</h3>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>Database / Job Library is the source of truth for roles, candidates, and scoring history; if unavailable, matching halts.</li>
            <li>Tenant Config feeds Feature Flags and Runtime Controls; disabled controls block the dependent agent call instead of silently passing while logging why.</li>
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
            <li>System Status pulls live subsystem health (agents, scoring, database, runtime controls) and aligns with this blueprint.</li>
            <li>Diagnostics aggregates health across ATS, flags, guardrails, retention, and logging.</li>
          </ul>
        </div>
      </section>
    </ETEClientLayout>
  );
}

function FlowPill({ label, subtitle }: { label: string; subtitle?: string }) {
  return (
    <span className="flex w-full min-w-0 items-start gap-2 rounded-full bg-indigo-50 px-3 py-1 text-left text-[13px] font-semibold leading-snug text-indigo-800 ring-1 ring-indigo-100 dark:bg-indigo-900/60 dark:text-indigo-100 dark:ring-indigo-700/60 sm:w-auto sm:min-w-[9rem] sm:max-w-[17rem]">
      <span className="mt-1 h-2 w-2 rounded-full bg-indigo-500" aria-hidden />
      <span className="flex flex-col whitespace-normal leading-tight">
        <span className="text-left text-balance break-words line-clamp-2">{label}</span>
        {subtitle ? (
          <span className="text-left text-[11px] font-medium text-indigo-700/80 break-words line-clamp-1 dark:text-indigo-200/80">{subtitle}</span>
        ) : null}
      </span>
    </span>
  );
}

function FlowArrow({ variant = "solid" }: { variant?: "solid" | "dashed" }) {
  return (
    <span className="flex items-center gap-1 self-start text-base font-semibold text-indigo-500 dark:text-indigo-200" aria-hidden>
      {variant === "dashed" ? (
        <span className="h-px w-8 border-b border-dashed border-indigo-400/80 dark:border-indigo-300/80" />
      ) : null}
      <span>→</span>
    </span>
  );
}
