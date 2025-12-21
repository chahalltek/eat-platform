"use client";

import { useMemo, useState } from "react";
import * as Switch from "@radix-ui/react-switch";

import { ClientActionLink } from "@/components/ClientActionLink";
import { StatusPill } from "@/components/StatusPill";
import {
  IMPACT_CLASS_ORDER,
  createDefaultNodeHealth,
  resolveSeverity,
  type HealthStatus,
  type ImpactClass,
  type NodeHealth,
  type SystemMapNode,
} from "@/app/system-map/opsImpact";
import { useSystemMapHealth } from "@/lib/hooks/useSystemMapHealth";

type FlowSequence = {
  label: string;
  steps: readonly string[];
  subtitles?: readonly string[];
  arrowVariant?: "solid" | "dashed";
  note?: string;
};

type StatusLegendItem = { status: HealthStatus; label: string };

type SystemMapContentProps = {
  apiMapDocUrl: string;
  apiMapLastUpdatedIso: string | null;
  apiMapLastUpdatedDisplay: string;
  systemNodes: readonly SystemMapNode[];
  flowSequences: readonly FlowSequence[];
  statusLegend: readonly StatusLegendItem[];
};

const healthStatusLabels: Record<HealthStatus, string> = {
  healthy: "Healthy",
  idle: "Idle",
  waiting: "Waiting",
  fault: "Fault",
  disabled: "Disabled",
};

const impactBadgeTone: Record<ImpactClass, string> = {
  halts: "bg-rose-50 text-rose-800 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-100 dark:ring-rose-800/60",
  fails_closed:
    "bg-amber-50 text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-100 dark:ring-amber-800/60",
  blocks:
    "bg-orange-50 text-orange-900 ring-1 ring-orange-200 dark:bg-orange-950/30 dark:text-orange-100 dark:ring-orange-800/60",
  degrades:
    "bg-indigo-50 text-indigo-900 ring-1 ring-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-100 dark:ring-indigo-800/60",
  isolated:
    "bg-slate-50 text-slate-800 ring-1 ring-slate-200 dark:bg-slate-950/30 dark:text-slate-100 dark:ring-slate-700/60",
};

const impactBadgeLabel: Record<ImpactClass, string> = {
  halts: "HALTS",
  fails_closed: "FAILS CLOSED",
  blocks: "BLOCKS",
  degrades: "DEGRADES",
  isolated: "ISOLATED",
};

export function SystemMapContent({
  apiMapDocUrl,
  apiMapLastUpdatedIso,
  apiMapLastUpdatedDisplay,
  systemNodes,
  flowSequences,
  statusLegend,
}: SystemMapContentProps) {
  const [overlayEnabled, setOverlayEnabled] = useState(false);
  const { health, isPolling, isUnavailable, lastUpdated } = useSystemMapHealth(overlayEnabled);
  const healthState = overlayEnabled ? health ?? createDefaultNodeHealth() : createDefaultNodeHealth();

  const faultsByImpact = useMemo(
    () =>
      IMPACT_CLASS_ORDER.map((impact) => ({
        impact,
        nodes: overlayEnabled
          ? systemNodes.filter((node) => healthState[node.id]?.status === "fault" && node.impact === impact)
          : [],
      })),
    [healthState, overlayEnabled, systemNodes],
  );

  const disabledNodes = useMemo(
    () =>
      overlayEnabled ? systemNodes.filter((node) => healthState[node.id]?.status === "disabled") : [],
    [healthState, overlayEnabled, systemNodes],
  );

  return (
    <div className="space-y-10">
      <section className="overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-6 shadow-sm dark:border-indigo-900/40 dark:from-indigo-950/60 dark:via-zinc-950 dark:to-emerald-950/40">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">System Map</p>
            <h1 className="text-4xl font-semibold leading-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
              EDGE Talent Engine data flow blueprint
            </h1>
            <p className="max-w-3xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
              How agents, engines, and the Control Plane hand off work. Open this when you need the blueprint for dependencies, guardrails,
              and failure modes — not just a link.
            </p>
            <div className="mt-1 rounded-xl border border-indigo-100 bg-white/80 p-3 text-sm leading-relaxed text-indigo-900 shadow-sm dark:border-indigo-800/60 dark:bg-zinc-900/80 dark:text-indigo-100/80">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700 dark:text-indigo-300">Why this matters</p>
              <p className="mt-1 text-indigo-900/80 dark:text-indigo-100/80">
                This blueprint makes it possible to understand where judgment happens, where automation stops, and how risk is controlled —
                without relying on individual knowledge or tribal memory.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700 ring-1 ring-indigo-100 dark:bg-zinc-900/70 dark:text-indigo-200 dark:ring-indigo-800/60">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
              <span>
                Last updated:{" "}
                <time dateTime={apiMapLastUpdatedIso ?? undefined}>{apiMapLastUpdatedDisplay}</time>
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
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Quick pointers so you know where to look without turning this into an endpoint catalog.</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            These routes exist to support agent execution and control-plane operations, not as a public API contract.
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Stability and semantics may change outside documented workflows.
          </p>
        </div>
        <ul className="grid gap-2 rounded-2xl border border-indigo-100 bg-white/80 p-4 text-sm leading-relaxed text-zinc-700 shadow-sm dark:border-indigo-800 dark:bg-zinc-950/60 dark:text-zinc-200 sm:grid-cols-2">
          {[
            { label: "Agent APIs", path: "/api/agents/*", context: "and job-scoped routes (matcher)" },
            { label: "Admin APIs", path: "/api/admin/*", context: "" },
            { label: "Tenant Ops APIs", path: "/api/tenant/*", context: "" },
          ].map((item) => (
            <li
              key={item.label}
              className="flex flex-col gap-1 rounded-xl bg-indigo-50/60 p-3 ring-1 ring-indigo-100 dark:bg-indigo-900/30 dark:ring-indigo-800/60"
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700 dark:text-indigo-200">
                {item.label}
              </span>
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

        <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          These flows are executed at intentional decision moments. Not every flow runs for every action.
        </p>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Use these flows to trace where judgment happens, where automation stops, and where to debug first.
        </p>

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
                        {index < sequence.steps.length - 1 ? <FlowArrow variant={sequence.arrowVariant} /> : null}
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

            <div className="space-y-4 rounded-2xl border border-indigo-100 bg-white/90 p-4 shadow-sm dark:border-indigo-800 dark:bg-zinc-900/80">
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-indigo-50/70 px-4 py-3 ring-1 ring-indigo-100 dark:bg-indigo-950/30 dark:ring-indigo-800/60">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700 dark:text-indigo-200">Ops impact overlay</p>
                  <p className="text-sm text-indigo-900/80 dark:text-indigo-100/80">
                    Toggle on to see impact classes and live health. Polls every 15s when enabled; backs off if the health service fails.
                  </p>
                  <p className="text-xs text-indigo-700/80 dark:text-indigo-200/80">
                    Highlights which failures affect scoring, matching, or submissions.
                  </p>
                  {isUnavailable ? (
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-200">
                      Health status unavailable. Using last known state.
                    </p>
                  ) : null}
                </div>
                <label className="flex items-center gap-3 text-sm font-semibold text-indigo-800 dark:text-indigo-100">
                  <span>{overlayEnabled ? "Overlay on" : "Overlay off"}</span>
                  <Switch.Root
                    checked={overlayEnabled}
                    onCheckedChange={setOverlayEnabled}
                    className="relative inline-flex h-7 w-12 items-center rounded-full bg-indigo-100 transition data-[state=checked]:bg-indigo-600"
                    aria-label="Toggle ops impact overlay"
                  >
                    <Switch.Thumb className="block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-150 will-change-transform translate-x-1 data-[state=checked]:translate-x-6" />
                  </Switch.Root>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {systemNodes.map((node) => {
                  const nodeStatus: HealthStatus = healthState[node.id]?.status ?? "healthy";
                  const isFault = overlayEnabled && nodeStatus === "fault";
                  const isDisabled = overlayEnabled && nodeStatus === "disabled";
                  const isControlPlane = node.type.toLowerCase() === "control plane";

                  return (
                    <div
                      key={node.id}
                      data-testid={`system-map-node-${node.id}`}
                      className={`flex h-full flex-col gap-3 rounded-2xl border border-indigo-100 bg-white/90 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-indigo-800 dark:bg-zinc-900/80 ${
                        isFault ? "border-rose-200 ring-2 ring-rose-100 dark:border-rose-700/60 dark:ring-rose-900/50" : ""
                      } ${isControlPlane ? "border-l-4 border-l-amber-300 bg-amber-50/70 dark:border-l-amber-500 dark:bg-amber-950/20" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">
                            {node.type}
                          </p>
                          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{node.name}</h3>
                        </div>
                        <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-900/50 dark:text-indigo-200 dark:ring-indigo-700/50">
                          Node
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-zinc-700 line-clamp-3 dark:text-zinc-300">{node.summary}</p>
                      {node.id === "confidence_explain" ? (
                        <div className="rounded-lg border border-indigo-100 bg-indigo-50/70 p-3 text-xs leading-relaxed text-indigo-900 dark:border-indigo-800/60 dark:bg-indigo-900/40 dark:text-indigo-100/80">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-700 dark:text-indigo-300">Why this matters</p>
                          <p className="mt-1 text-indigo-900/80 dark:text-indigo-100/80">
                            Decisions become explainable, defensible, and auditable here — turning outcomes into durable organizational memory.
                          </p>
                        </div>
                      ) : null}
                      {node.hint ? <p className="text-xs text-zinc-600 dark:text-zinc-400">{node.hint}</p> : null}
                      {overlayEnabled ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${impactBadgeTone[node.impact]}`}
                          >
                            {impactBadgeLabel[node.impact]}
                          </span>
                          <StatusPill status={nodeStatus} label={healthStatusLabels[nodeStatus]} />
                          {isPolling ? (
                            <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-200">Updating…</span>
                          ) : null}
                        </div>
                      ) : null}
                      {isFault ? (
                        <p className="text-sm font-semibold text-rose-700 dark:text-rose-200">Currently impacting this path.</p>
                      ) : null}
                      {isDisabled ? (
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Disabled (intentional).</p>
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
                  );
                })}
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                <div className="space-y-3 rounded-2xl border border-indigo-100/70 bg-white/80 p-4 shadow-sm dark:border-indigo-800/60 dark:bg-zinc-950/60">
                  <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Status grammar</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">Colors communicate state without relying on labels.</p>
                  <div className="space-y-2">
                    {statusLegend.map((item) => (
                      <div
                        key={item.status}
                        className="flex items-center justify-between rounded-lg border border-indigo-100 bg-white/80 px-3 py-2 dark:border-indigo-800 dark:bg-zinc-950/60"
                      >
                        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{item.label}</span>
                        <StatusPill status={item.status} label={item.label} />
                      </div>
                    ))}
                  </div>
                </div>

                {overlayEnabled ? (
                  <LiveImpactSummary
                    faultsByImpact={faultsByImpact}
                    disabledNodes={disabledNodes}
                    lastUpdated={lastUpdated}
                    healthState={healthState}
                  />
                ) : null}
              </div>
            </div>

            <p className="text-xs text-indigo-700/90 dark:text-indigo-200/80">
              These nodes constrain behavior and safety. They do not execute workflows.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70">
          <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Data flow highlights</h3>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>
              ATS adapters sync jobs and candidates when connected; resume uploads and manual intake remain alternate entry points.
            </li>
            <li>Job descriptions land in Intake and flow through RUA before any scoring is permitted.</li>
            <li>
              Resumes move Intake → RINA → Database (Job Library) → Scoring engine; downstream agents only touch normalized profiles.
            </li>
            <li>
              Scoring engine requires both role and candidate profiles; outputs are immutable inputs to Confidence / Explain.
            </li>
            <li>Confidence / Explain block bad data and record rationales alongside scores for auditability.</li>
            <li>Tenant Config injects feature flags and weighting rules; if disabled, dependent steps halt instead of silently passing.</li>
            <li>Runtime Controls + Feature Flags gate execution; disabled features fail closed and log why.</li>
            <li>Control Plane feeds thresholds, flags, and runtime latches; dependent steps halt instead of falling back when controls disable them.</li>
            <li>Agent runs emit structured run logs and audit events (success/failure + rationale).</li>
          </ul>
        </div>

        <div className="space-y-3 rounded-2xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70">
          <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Ownership boundaries</h3>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>UI collects inputs and surfaces results; it never rewrites agent outputs.</li>
            <li>
              Agents own interpretation: RUA shapes roles, RINA normalizes resumes, Scoring engine ranks, Confidence / Explain gate quality.
            </li>
            <li>Data correctness checks live in Confidence / Explain; downstream consumers reuse those signals instead of revalidating.</li>
            <li>System Status pulls live subsystem health (agents, scoring, database, Control Plane runtime controls) and aligns with this blueprint.</li>
            <li>Diagnostics aggregates health across ATS, flags, guardrails, retention, and logging.</li>
          </ul>
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
            <li>
              Database / Job Library is the source of truth for roles, candidates, and scoring history; if unavailable, matching halts.
            </li>
            <li>
              Tenant Config feeds Feature Flags and Runtime Controls; disabled controls block the dependent agent or engine call instead of silently passing while logging why.
            </li>
            <li>Scoring pipeline expects structured profiles; malformed data fails fast rather than auto-correcting.</li>
            <li>Blueprint view mirrors the dashboard header style to reinforce that this is part of the core control plane.</li>
          </ul>
        </div>

        <div className="space-y-3 rounded-2xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70">
          <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Status cadence</h3>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <li>Ops impact overlay polls every 15 seconds when enabled; backs off to 60 seconds after three failed attempts.</li>
            <li>Disabled components are labeled as intentional and do not count toward incident severity.</li>
            <li>Severity is derived from impact class: HALTS/FAILS CLOSED = SEV-1, BLOCKS = SEV-2, DEGRADES = SEV-3, ISOLATED = SEV-4.</li>
            <li>Health pills and summaries only render while the overlay is enabled.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

function LiveImpactSummary({
  faultsByImpact,
  disabledNodes,
  lastUpdated,
  healthState,
}: {
  faultsByImpact: Array<{ impact: ImpactClass; nodes: SystemMapNode[] }>;
  disabledNodes: SystemMapNode[];
  lastUpdated: string | null;
  healthState: NodeHealth;
}) {
  const hasFaults = faultsByImpact.some((group) => group.nodes.length > 0);

  return (
    <div className="space-y-3 rounded-2xl border border-emerald-100/80 bg-emerald-50/60 p-4 shadow-sm ring-1 ring-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:ring-emerald-900/60">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-200">Live impact summary</p>
          <p className="text-sm text-emerald-800 dark:text-emerald-100/90">Active faults grouped by impact class.</p>
        </div>
        {lastUpdated ? <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-200">Refreshed</span> : null}
      </div>

      {hasFaults ? (
        <div className="space-y-2">
          {faultsByImpact.map((group) => {
            if (group.nodes.length === 0) return null;

            return (
              <div key={group.impact} className="rounded-xl border border-emerald-200/80 bg-white/70 p-3 dark:border-emerald-800/50 dark:bg-emerald-950/30">
                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-50">
                  {impactBadgeLabel[group.impact]} ({resolveSeverity(group.impact)}):
                </p>
                <p className="text-sm text-emerald-800 dark:text-emerald-100">
                  {group.nodes.map((node) => node.name).join(", ")}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-100">No active faults detected.</p>
      )}

      {disabledNodes.length > 0 ? (
        <div className="rounded-lg border border-emerald-200 bg-white/70 p-3 text-sm text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-100">
          <p className="font-semibold">Disabled (intentional):</p>
          <p>{disabledNodes.map((node) => node.name).join(", ")}</p>
        </div>
      ) : null}

      {lastUpdated ? (
        <p className="text-xs text-emerald-800/80 dark:text-emerald-100/80">
          Using data captured at <time dateTime={lastUpdated}>{new Date(lastUpdated).toLocaleTimeString()}</time>.
        </p>
      ) : null}

      {Object.values(healthState).every((entry) => entry.status === "healthy") && (
        <p className="text-xs text-emerald-800/80 dark:text-emerald-100/80">
          All monitored nodes are reporting healthy.
        </p>
      )}
    </div>
  );
}

function FlowPill({ label, subtitle }: { label: string; subtitle?: string }) {
  return (
    <span className="flex w-full min-w-0 items-start gap-2 rounded-full bg-indigo-50 px-3 py-1 text-left text-[13px] font-semibold leading-snug text-indigo-800 ring-1 ring-indigo-100 dark:bg-indigo-900/60 dark:text-indigo-100 dark:ring-indigo-700/60 sm:w-auto sm:min-w-[9rem] sm:max-w-[17rem]">
      <span className="mt-1 h-2 w-2 rounded-full bg-indigo-500" aria-hidden />
      <span className="flex flex-col whitespace-normal leading-tight">
        <span className="text-left text-balance break-words line-clamp-2">{label}</span>
        {subtitle ? (
          <span className="text-left text-[11px] font-medium text-indigo-700/80 break-words line-clamp-1 dark:text-indigo-200/80">
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  );
}

function FlowArrow({ variant = "solid" }: { variant?: "solid" | "dashed" }) {
  return (
    <span className="flex items-center gap-1 self-start text-base font-semibold text-indigo-500 dark:text-indigo-200" aria-hidden>
      {variant === "dashed" ? <span className="h-px w-8 border-b border-dashed border-indigo-400/80 dark:border-indigo-300/80" /> : null}
      <span>→</span>
    </span>
  );
}
