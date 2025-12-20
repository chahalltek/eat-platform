"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import clsx from "clsx";

import { StatusPill } from "@/components/StatusPill";
import { categorizeConfidence } from "@/app/jobs/[jobId]/matches/confidence";
import type { Explanation } from "@/lib/agents/explainEngine";
import {
  createDecisionStream,
  logDecisionStreamItem,
  type DecisionStreamAction,
  type DecisionStreamItem,
} from "@/lib/metrics/decisionStreamClient";

export type AgentName = "MATCH" | "CONFIDENCE" | "EXPLAIN" | "SHORTLIST";

export type JobConsoleCandidate = {
  candidateId: string;
  candidateName: string;
  score: number | null;
  confidenceScore: number | null;
  confidenceBand: "HIGH" | "MEDIUM" | "LOW" | null;
  shortlisted: boolean;
  explanation: (Explanation & { summaryOnly?: boolean }) | null;
};

export type JobConsoleProps = {
  jobId: string;
  jobTitle: string;
  jobLocation: string | null;
  summary: string | null;
  mustHaveSkills: string[];
  initialCandidates: JobConsoleCandidate[];
  agentState: {
    name: AgentName;
    enabled: boolean;
  }[];
  modeLabel: string;
  modeDescription?: string | null;
};

type DecisionReceipt = {
  id: string;
  jobId: string;
  candidateId: string;
  candidateName: string;
  decisionType: "RECOMMEND" | "SUBMIT" | "REJECT" | "PASS";
  drivers: string[];
  tradeoff: string | null;
  confidenceScore: number | null;
  risks: string[];
  summary: string;
  createdAt: string;
  createdBy?: { id?: string; name?: string | null; email?: string | null };
  bullhornNote?: string;
  bullhornTarget?: "note" | "custom_field";
};

function normalizeExplanation(
  source: unknown,
  options?: { summaryOnly?: boolean },
): JobConsoleCandidate["explanation"] {
  if (!source) return null;

  if (typeof source === "string") {
    return { summary: source, strengths: [], risks: [], summaryOnly: options?.summaryOnly ?? true } satisfies JobConsoleCandidate["explanation"];
  }

  if (typeof source === "object") {
    const data = source as { summary?: unknown; strengths?: unknown; risks?: unknown; summaryOnly?: unknown; text?: unknown };
    const strengths = Array.isArray(data.strengths)
      ? data.strengths.map((entry) => String(entry)).filter(Boolean)
      : [];
    const risks = Array.isArray(data.risks)
      ? data.risks.map((entry) => String(entry)).filter(Boolean)
      : [];
    const summaryCandidate = typeof data.summary === "string" && data.summary.trim().length > 0 ? data.summary : undefined;
    const summaryFallback = typeof data.text === "string" && data.text.trim().length > 0 ? data.text : undefined;
    const summary = summaryCandidate ?? summaryFallback;

    if (!summary && strengths.length === 0 && risks.length === 0) {
      return null;
    }

    return {
      summary: summary ?? "Explanation not generated yet.",
      strengths,
      risks,
      summaryOnly: options?.summaryOnly ?? (data.summaryOnly as boolean | undefined) ?? (strengths.length === 0 && risks.length === 0),
    } satisfies JobConsoleCandidate["explanation"];
  }

  return null;
}

function AgentToggleNotice({
  agents,
  modeLabel,
}: {
  agents: JobConsoleProps["agentState"];
  modeLabel: string;
}) {
  const enabled = agents.filter((agent) => agent.enabled).map((agent) => agent.name);
  const disabled = agents.filter((agent) => !agent.enabled).map((agent) => agent.name);

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
      <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-800 ring-1 ring-slate-200">
        Mode: {modeLabel}
      </span>
      <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700 ring-1 ring-emerald-100">
        Available: {enabled.length > 0 ? enabled.join(", ") : "None"}
      </span>
      {disabled.length > 0 ? (
        <span className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-700 ring-1 ring-amber-200">
          Disabled: {disabled.join(", ")}
        </span>
      ) : null}
    </div>
  );
}

function ConfidenceBadge({ band }: { band: JobConsoleCandidate["confidenceBand"] }) {
  if (!band) return <span className="text-slate-500">—</span>;

  const tone =
    band === "HIGH"
      ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
      : band === "MEDIUM"
        ? "bg-amber-100 text-amber-800 ring-amber-200"
        : "bg-rose-100 text-rose-800 ring-rose-200";

  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ring-1", tone)}>
      <span className="h-2 w-2 rounded-full bg-current" aria-hidden />
      {band} confidence
    </span>
  );
}

type DecisionSnapshot = { favorited: boolean; removed: boolean; shortlisted: boolean };

const DEFAULT_DECISION_STATE: DecisionSnapshot = { favorited: false, removed: false, shortlisted: false };

<<<<<<< ours
function normalizeConfidenceToTenPoint(score?: number | null): number | null {
  if (typeof score !== "number" || Number.isNaN(score)) return null;
  const normalized = score > 10 ? score / 10 : score;
  return Math.max(0, Math.min(10, Math.round(normalized * 10) / 10));
}

function mapDecisionActionToReceipt(action: DecisionStreamAction): DecisionReceipt["decisionType"] | null {
  if (action === "SHORTLISTED" || action === "FAVORITED") return "RECOMMEND";
  if (action === "REMOVED") return "REJECT";
  return null;
}

function describeTradeoffFromStrategy(strategy: "quality" | "strict" | "fast") {
  if (strategy === "fast") return "Accepted speed over precision to keep req momentum.";
  if (strategy === "strict") return "Prioritized precision over coverage to protect quality.";
  return "Balanced quality and coverage with recruiter judgment.";
}

function formatDecisionLabel(decisionType: DecisionReceipt["decisionType"]) {
  const labels: Record<DecisionReceipt["decisionType"], string> = {
    RECOMMEND: "Recommend",
    SUBMIT: "Submit",
    REJECT: "Reject",
    PASS: "Pass",
  };

  return labels[decisionType];
=======
function toDecisionConfidence(candidate?: JobConsoleCandidate): { score: number; band: JobConsoleCandidate["confidenceBand"] } {
  const rawScore = candidate?.confidenceScore;
  const score = typeof rawScore === "number" ? rawScore : null;
  const normalized = score === null ? 5 : Math.min(10, Math.max(0, Number(((score > 10 ? score / 10 : score)).toFixed(2))));
  return { score: normalized, band: candidate?.confidenceBand ?? null };
>>>>>>> theirs
}

function DecisionActions({
  state,
  onDecision,
}: {
  state: DecisionSnapshot;
  onDecision: (action: DecisionStreamAction) => void;
}) {
  const buttons: Array<{ label: string; action: DecisionStreamAction; active: boolean; tone: string }> = [
    { label: "Shortlist", action: "SHORTLISTED", active: state.shortlisted, tone: "emerald" },
    { label: "Remove", action: "REMOVED", active: state.removed, tone: "rose" },
    { label: "Favorite", action: "FAVORITED", active: state.favorited, tone: "amber" },
  ];

  const toneClasses: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-800 ring-emerald-200 hover:bg-emerald-100",
    rose: "bg-rose-50 text-rose-800 ring-rose-200 hover:bg-rose-100",
    amber: "bg-amber-50 text-amber-800 ring-amber-200 hover:bg-amber-100",
  };

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Decision actions">
      {buttons.map((button) => (
        <button
          key={button.action}
          type="button"
          onClick={() => onDecision(button.action)}
          className={clsx(
            "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ring-1",
            toneClasses[button.tone],
            button.active ? "opacity-100" : "opacity-80",
          )}
          aria-pressed={button.active}
        >
          {button.action === "FAVORITED" ? "⭐" : <span className="h-2 w-2 rounded-full bg-current" aria-hidden />}
          {button.label}
        </button>
      ))}
    </div>
  );
}

function ResultsTable({
  candidates,
  expandedId,
  explainUnavailable,
  showFireDrillBadge,
  onToggle,
  showShortlistedOnly,
  decisionStates,
  onDecision,
  onViewed,
  receiptsByCandidate,
}: {
  candidates: JobConsoleCandidate[];
  expandedId: string | null;
  explainUnavailable: boolean;
  showFireDrillBadge: boolean;
  onToggle: (id: string) => void;
  showShortlistedOnly: boolean;
  decisionStates: Record<string, DecisionSnapshot>;
  onDecision: (candidate: JobConsoleCandidate, action: DecisionStreamAction) => void;
  onViewed: (candidate: JobConsoleCandidate) => void;
  receiptsByCandidate: Record<string, DecisionReceipt[]>;
}) {
  if (candidates.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-6 py-10 text-center shadow-sm">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 ring-1 ring-slate-200">
            <span className="h-2 w-2 rounded-full bg-indigo-400" aria-hidden />
            No candidates yet
          </div>
          <h3 className="text-xl font-semibold text-slate-900">
            {showShortlistedOnly ? "Waiting for shortlist results" : "Waiting for a MATCH run"}
          </h3>
          <p className="max-w-lg text-sm leading-relaxed text-slate-600">
            {showShortlistedOnly
              ? "No shortlisted candidates to show yet. Run SHORTLIST to see recommendations."
              : "Kick off MATCH to pull candidates into the console. Confidence, explanations, and shortlist actions will unlock as soon as results arrive."}
          </p>
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" aria-hidden />
            Run MATCH to begin
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Candidate</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Confidence band</th>
              <th className="px-4 py-3">Shortlisted</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {candidates.map((candidate) => {
              const expanded = expandedId === candidate.candidateId;
              const receipts = receiptsByCandidate[candidate.candidateId] ?? [];

              return (
                <>
                  <tr key={candidate.candidateId} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      <Link
                        href={`/candidates/${candidate.candidateId}`}
                        target="_blank"
                        className="text-indigo-700 underline decoration-indigo-200 underline-offset-4 hover:text-indigo-900"
                        onClick={() => onViewed(candidate)}
                      >
                        {candidate.candidateName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {typeof candidate.score === "number" ? `${candidate.score}%` : <span className="text-slate-500">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <ConfidenceBadge band={candidate.confidenceBand} />
                    </td>
                  <td className="px-4 py-3">
                    <span
                      className={clsx(
                        "inline-flex h-7 w-7 items-center justify-center rounded-full ring-1",
                        candidate.shortlisted
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                          : "bg-slate-50 text-slate-400 ring-slate-200",
                      )}
                      aria-label={candidate.shortlisted ? "Shortlisted" : "Not shortlisted"}
                    >
                      {candidate.shortlisted ? "✓" : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <DecisionActions
                        state={decisionStates[candidate.candidateId] ?? DEFAULT_DECISION_STATE}
                        onDecision={(action) => onDecision(candidate, action)}
                      />
                      {showFireDrillBadge ? (
                        <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700 ring-1 ring-amber-100">
                          Fire Drill mode
                        </span>
                      ) : null}
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                        title="Copy justification"
                        disabled
                      >
                        Copy justification
                        <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Soon</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggle(candidate.candidateId)}
                        disabled={explainUnavailable && !candidate.explanation}
                        title={explainUnavailable && !candidate.explanation ? "EXPLAIN disabled in current mode." : undefined}
                          className={clsx(
                            "text-sm font-semibold underline decoration-indigo-200 underline-offset-4",
                            explainUnavailable && !candidate.explanation
                              ? "cursor-not-allowed text-slate-500"
                              : "text-indigo-700 hover:text-indigo-900",
                          )}
                        >
                          {expanded ? "Hide" : "Explain"}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expanded ? (
                    <tr className="bg-indigo-50/40" key={`${candidate.candidateId}-explanation`}>
                      <td colSpan={5} className="px-4 py-4 text-sm text-slate-800">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Summary</p>
                            {candidate.explanation?.summaryOnly ? (
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700 ring-1 ring-slate-200">
                                Summary only
                              </span>
                            ) : null}
                          </div>
                          <p className="leading-relaxed text-slate-900">{candidate.explanation?.summary ?? "Explanation not generated yet."}</p>

                          {candidate.explanation?.summaryOnly ? (
                            <p className="text-xs text-amber-700">Detailed strengths and risks are paused in this mode.</p>
                          ) : null}

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2 rounded-xl bg-white p-4 ring-1 ring-slate-200">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Strengths</p>
                              {candidate.explanation?.strengths?.length ? (
                                <ul className="list-disc space-y-1 pl-4 text-slate-800">
                                  {candidate.explanation.strengths.map((item) => (
                                    <li key={item}>{item}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-sm text-slate-500">Run EXPLAIN to surface strengths.</p>
                              )}
                            </div>
                            <div className="space-y-2 rounded-xl bg-white p-4 ring-1 ring-slate-200">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Risks</p>
                              {candidate.explanation?.risks?.length ? (
                                <ul className="list-disc space-y-1 pl-4 text-slate-800">
                                  {candidate.explanation.risks.map((item) => (
                                    <li key={item}>{item}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-sm text-slate-500">Run EXPLAIN to capture risks.</p>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2 rounded-xl bg-white p-4 ring-1 ring-slate-200">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Decision receipts</p>
                              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                {receipts.length} recorded
                              </span>
                            </div>
                            <DecisionReceiptList receipts={receipts} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DecisionReceiptList({ receipts }: { receipts: DecisionReceipt[] }) {
  if (!receipts.length) {
    return <p className="text-sm text-slate-600">Receipts will appear after you recommend or reject a candidate.</p>;
  }

  return (
    <div className="space-y-3">
      {receipts.map((receipt) => (
        <div key={receipt.id} className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-800 ring-1 ring-indigo-200">
                {formatDecisionLabel(receipt.decisionType)}
              </span>
              {typeof receipt.confidenceScore === "number" ? (
                <span className="text-[11px] font-semibold text-slate-600">{receipt.confidenceScore.toFixed(1)}/10 confidence</span>
              ) : (
                <span className="text-[11px] text-slate-500">Confidence pending</span>
              )}
            </div>
            <span className="text-[11px] text-slate-500">
              {new Date(receipt.createdAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-800">{receipt.summary}</p>
          <p className="text-xs text-slate-600">
            Drivers: {receipt.drivers.length ? receipt.drivers.join("; ") : "Not captured"} • Risks: {receipt.risks.length ? receipt.risks.join("; ") : "Not captured"}
          </p>
          <p className="text-[11px] font-semibold text-indigo-700">
            Synced to Bullhorn as {receipt.bullhornTarget === "custom_field" ? "custom field payload" : "note"}.
          </p>
        </div>
      ))}
    </div>
  );
}

function ExecutionToolbar({
  onRun,
  disabled,
  running,
  shortlistStrategy,
  onShortlistStrategyChange,
}: {
  onRun: (agent: AgentName) => void;
  disabled: Record<AgentName, boolean>;
  running: AgentName | null;
  shortlistStrategy: "quality" | "strict" | "fast";
  onShortlistStrategyChange: (strategy: "quality" | "strict" | "fast") => void;
}) {
  const buttonClasses = {
    MATCH: "bg-slate-900 text-white",
    CONFIDENCE: "bg-indigo-50 text-indigo-900 ring-1 ring-indigo-200",
    EXPLAIN: "bg-slate-100 text-slate-900",
  } as const;

  const labels: Record<Exclude<AgentName, "SHORTLIST">, string> = {
    MATCH: "Run MATCH",
    CONFIDENCE: "Run CONFIDENCE",
    EXPLAIN: "Run EXPLAIN",
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex flex-wrap gap-3">
        {(Object.keys(labels) as Exclude<AgentName, "SHORTLIST">[]).map((agent) => {
          const isRunning = running === agent;
          const isDisabled = disabled[agent] || Boolean(running);

          return (
            <button
              key={agent}
              type="button"
              onClick={() => onRun(agent)}
              disabled={isDisabled}
              title={disabled[agent] ? "Disabled in current mode." : undefined}
              className={clsx(
                "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition",
                isDisabled ? "opacity-60" : "hover:-translate-y-0.5 hover:shadow-md",
                buttonClasses[agent],
              )}
            >
              <span className="relative flex items-center gap-2">
                {isRunning ? (
                  <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em]">
                    <span className="relative flex h-2 w-2 items-center justify-center">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" aria-hidden />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-current" aria-hidden />
                    </span>
                    Running
                  </span>
                ) : null}
                <span>{labels[agent]}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-xl bg-white p-4 ring-1 ring-emerald-100 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Shortlist strategy</p>
          <p className="text-sm text-slate-600">Choose how aggressive the shortlist should be before running the agent.</p>
          <div className="flex flex-wrap items-center gap-2">
            {["quality", "strict", "fast"].map((option) => (
              <label
                key={option}
                className={clsx(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] ring-1 transition",
                  shortlistStrategy === option
                    ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                    : "bg-slate-50 text-slate-600 ring-slate-200 hover:bg-slate-100",
                )}
              >
                <input
                  type="radio"
                  name="shortlist-strategy"
                  value={option}
                  checked={shortlistStrategy === option}
                  onChange={() => onShortlistStrategyChange(option as "quality" | "strict" | "fast")}
                  className="sr-only"
                />
                {option}
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <button
            type="button"
            onClick={() => onRun("SHORTLIST")}
            disabled={disabled.SHORTLIST || Boolean(running)}
            title={disabled.SHORTLIST ? "Shortlist agent disabled in this mode." : undefined}
            className={clsx(
              "inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition",
              disabled.SHORTLIST || Boolean(running) ? "opacity-60" : "hover:-translate-y-0.5 hover:shadow-md",
            )}
          >
            <span className="relative flex items-center gap-2">
              {running === "SHORTLIST" ? (
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em]">
                  <span className="relative flex h-2 w-2 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" aria-hidden />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-white" aria-hidden />
                  </span>
                  Running
                </span>
              ) : null}
              <span>Run Shortlist!</span>
            </span>
          </button>
          <p className="text-[11px] text-slate-500">Default strategy is quality-focused.</p>
        </div>
      </div>
    </div>
  );
}

export function JobExecutionConsole(props: JobConsoleProps) {
  const { jobId, jobTitle, jobLocation, summary, mustHaveSkills, initialCandidates, agentState, modeLabel, modeDescription } =
    props;
  const normalizeCandidate = (candidate: JobConsoleCandidate): JobConsoleCandidate => ({
    ...candidate,
    explanation: normalizeExplanation(candidate.explanation),
  });

  const [candidates, setCandidates] = useState<JobConsoleCandidate[]>(initialCandidates.map(normalizeCandidate));
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [runningAgent, setRunningAgent] = useState<AgentName | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [shortlistStrategy, setShortlistStrategy] = useState<"quality" | "strict" | "fast">("quality");
  const [showShortlistedOnly, setShowShortlistedOnly] = useState(false);
  const [decisionStreamId, setDecisionStreamId] = useState<string | null>(null);
  const [decisionStates, setDecisionStates] = useState<Record<string, DecisionSnapshot>>({});
  const [receiptsByCandidate, setReceiptsByCandidate] = useState<Record<string, DecisionReceipt[]>>({});

  const storageKey = useMemo(() => `ete-job-console-${jobId}`, [jobId]);

  const groupReceiptsByCandidate = useCallback((receipts: DecisionReceipt[]) => {
    const grouped = receipts.reduce((acc, receipt) => {
      const existing = acc[receipt.candidateId] ?? [];
      const merged = [...existing, receipt].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      return { ...acc, [receipt.candidateId]: merged };
    }, {} as Record<string, DecisionReceipt[]>);

    setReceiptsByCandidate(grouped);
  }, []);

  const appendReceipt = useCallback((receipt: DecisionReceipt) => {
    setReceiptsByCandidate((prev) => {
      const existing = prev[receipt.candidateId] ?? [];
      const merged = [receipt, ...existing].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      return { ...prev, [receipt.candidateId]: merged };
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const streamId = await createDecisionStream(jobId);
      if (!cancelled && streamId) {
        setDecisionStreamId(streamId);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch(`/api/decision-receipts?jobId=${jobId}`);
        if (!res.ok) throw new Error(`Failed to load receipts with status ${res.status}`);
        const payload = (await res.json()) as { receipts?: DecisionReceipt[] };
        if (!cancelled && payload.receipts) {
          groupReceiptsByCandidate(payload.receipts);
        }
      } catch (error) {
        console.warn("Failed to load decision receipts", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [jobId, groupReceiptsByCandidate]);

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(storageKey);
      if (cached) {
        const parsed = JSON.parse(cached) as JobConsoleCandidate[];
        setCandidates(parsed.map(normalizeCandidate));
        return;
      }
    } catch (err) {
      console.warn("Failed to read cached console data", err);
    }

    setCandidates(initialCandidates.map(normalizeCandidate));
  }, [storageKey, initialCandidates]);

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(candidates));
    } catch (err) {
      console.warn("Failed to cache console data", err);
    }
  }, [candidates, storageKey]);

  const disabled: Record<AgentName, boolean> = useMemo(() => {
    const stateByAgent = new Map(agentState.map((entry) => [entry.name, entry.enabled]));
    return {
      MATCH: !(stateByAgent.get("MATCH") ?? false),
      CONFIDENCE: !(stateByAgent.get("CONFIDENCE") ?? false),
      EXPLAIN: !(stateByAgent.get("EXPLAIN") ?? false),
      SHORTLIST: !(stateByAgent.get("SHORTLIST") ?? false),
    } satisfies Record<AgentName, boolean>;
  }, [agentState]);

  const visibleCandidates = useMemo(
    () => (showShortlistedOnly ? candidates.filter((candidate) => candidate.shortlisted) : candidates),
    [candidates, showShortlistedOnly],
  );

  const explainUnavailable = disabled.EXPLAIN;
  const isFireDrillMode = modeLabel.toLowerCase().includes("fire drill");

  const logDecision = useCallback(
    (item: Omit<DecisionStreamItem, "streamId" | "jobId">) => {
      const confidence = toDecisionConfidence(candidates.find((candidate) => candidate.candidateId === item.candidateId));

      void logDecisionStreamItem({
        ...item,
        jobId,
        streamId: decisionStreamId,
        confidence: confidence.score,
        confidenceBand: confidence.band ?? undefined,
      });
    },
    [candidates, decisionStreamId, jobId],
  );

  const persistDecisionReceipt = useCallback(
    async (candidate: JobConsoleCandidate, action: DecisionStreamAction) => {
      const decisionType = mapDecisionActionToReceipt(action);
      if (!decisionType) return;

      const payload = {
        jobId,
        candidateId: candidate.candidateId,
        candidateName: candidate.candidateName,
        decisionType,
        drivers: candidate.explanation?.strengths?.slice(0, 3) ?? [],
        risks: candidate.explanation?.risks?.slice(0, 3) ?? [],
        confidenceScore: normalizeConfidenceToTenPoint(candidate.confidenceScore),
        summary: candidate.explanation?.summary ?? undefined,
        tradeoff: describeTradeoffFromStrategy(shortlistStrategy),
        bullhornTarget: "note" as const,
        shortlistStrategy,
      };

      try {
        const res = await fetch("/api/decision-receipts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error(`Decision receipt request failed with status ${res.status}`);

        const body = (await res.json()) as { receipt?: DecisionReceipt };
        if (body.receipt) {
          appendReceipt(body.receipt);
        }
      } catch (error) {
        console.warn("Failed to persist decision receipt", error);
      }
    },
    [appendReceipt, jobId, shortlistStrategy],
  );

  const handleDecision = useCallback(
    (candidate: JobConsoleCandidate, action: DecisionStreamAction) => {
      const labels: Record<DecisionStreamAction, string> = {
        VIEWED: "Viewed (new tab)",
        SHORTLISTED: "Shortlisted",
        REMOVED: "Removed from consideration",
        FAVORITED: "Favorited",
      };

      setDecisionStates((prev) => {
        const current = prev[candidate.candidateId] ?? DEFAULT_DECISION_STATE;
        const next: DecisionSnapshot = {
          ...current,
          shortlisted: action === "SHORTLISTED" ? true : action === "REMOVED" ? false : current.shortlisted,
          removed: action === "REMOVED" ? true : action === "SHORTLISTED" ? false : current.removed,
          favorited: action === "FAVORITED" ? !current.favorited : current.favorited,
        };

        return { ...prev, [candidate.candidateId]: next };
      });

      if (action === "SHORTLISTED") {
        setCandidates((prev) => prev.map((row) => (row.candidateId === candidate.candidateId ? { ...row, shortlisted: true } : row)));
      }

      if (action === "REMOVED") {
        setCandidates((prev) => prev.map((row) => (row.candidateId === candidate.candidateId ? { ...row, shortlisted: false } : row)));
      }

      void persistDecisionReceipt(candidate, action);

      logDecision({
        action,
        candidateId: candidate.candidateId,
        label: labels[action],
        details: { candidateName: candidate.candidateName },
      });
    },
    [logDecision, persistDecisionReceipt],
  );

  const handleViewed = useCallback(
    (candidate: JobConsoleCandidate) => {
      handleDecision(candidate, "VIEWED");
    },
    [handleDecision],
  );

  function normalizeBand(category?: string | null): JobConsoleCandidate["confidenceBand"] {
    if (!category) return null;
    const upper = category.toUpperCase();
    if (upper === "HIGH" || upper === "MEDIUM" || upper === "LOW") return upper;
    return null;
  }

  async function runAgent(agent: AgentName) {
    setMessage(null);
    setError(null);
    setRunningAgent(agent);
    try {
      if (agent === "MATCH") {
        const res = await fetch(`/api/jobs/${jobId}/matcher`, { method: "POST" });
        if (!res.ok) throw new Error(`MATCH failed with ${res.status}`);
        const payload = (await res.json()) as {
          matches: Array<{
            candidateId: string;
            matchScore: number;
            confidence: number;
            confidenceCategory?: string;
          }>;
        };

        setCandidates((prev) => {
          const byId = new Map(prev.map((row) => [row.candidateId, row]));

          for (const match of payload.matches) {
            const existing = byId.get(match.candidateId);
            const updated: JobConsoleCandidate = {
              candidateId: match.candidateId,
              candidateName: existing?.candidateName ?? `Candidate ${match.candidateId.slice(0, 6)}`,
              score: Math.round(match.matchScore),
              confidenceScore: Math.round(match.confidence),
              confidenceBand: normalizeBand(match.confidenceCategory) ?? normalizeBand(categorizeConfidence(match.confidence)),
              shortlisted: existing?.shortlisted ?? false,
              explanation: existing?.explanation ?? normalizeExplanation("Explanation not generated yet.", { summaryOnly: true }),
            };

            byId.set(match.candidateId, updated);
          }

          return Array.from(byId.values()).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        });

        setMessage("MATCH completed. Scores updated.");
        setLastUpdated(new Date());
      }

      if (agent === "CONFIDENCE") {
        const res = await fetch(`/api/jobs/${jobId}/confidence`, { method: "POST" });
        if (!res.ok) throw new Error(`CONFIDENCE failed with ${res.status}`);
        const payload = (await res.json()) as {
          results: Array<{ candidateId: string; score: number; confidenceBand: string }>;
        };

        setCandidates((prev) =>
          prev.map((row) => {
            const updated = payload.results.find((entry) => entry.candidateId === row.candidateId);
            if (!updated) return row;
            const band = normalizeBand(updated.confidenceBand);
            const confidenceScore = updated.score <= 1 ? Math.round(updated.score * 100) : Math.round(updated.score);
            return { ...row, confidenceScore, confidenceBand: band };
          }),
        );

        setMessage("Confidence bands refreshed.");
        setLastUpdated(new Date());
      }

      if (agent === "EXPLAIN") {
        const res = await fetch(`/api/jobs/${jobId}/explain`, { method: "POST" });
        if (!res.ok) throw new Error(`EXPLAIN failed with ${res.status}`);
        const payload = (await res.json()) as { explanations: Array<{ candidateId: string; explanation: Explanation }> };

        setCandidates((prev) =>
          prev.map((row) => {
            const explanation = payload.explanations.find((entry) => entry.candidateId === row.candidateId);
            if (!explanation) return row;
            return { ...row, explanation: normalizeExplanation(explanation.explanation, { summaryOnly: false }) };
          }),
        );

        setMessage("Explain summaries updated.");
        setLastUpdated(new Date());
      }

      if (agent === "SHORTLIST") {
        const res = await fetch(`/api/jobs/${jobId}/shortlist`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ strategy: shortlistStrategy }),
        });
        if (!res.ok) throw new Error(`SHORTLIST failed with ${res.status}`);
        const payload = (await res.json()) as {
          shortlistedCandidates: Array<{ candidateId: string }>;
          totalMatches: number;
        };

        const shortlistedIds = new Set(payload.shortlistedCandidates.map((entry) => entry.candidateId));

        setCandidates((prev) =>
          prev.map((row) => ({ ...row, shortlisted: shortlistedIds.has(row.candidateId) })),
        );

        setMessage(`Shortlist updated using ${shortlistStrategy} strategy.`);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error("Failed to run agent", err);
      setError(err instanceof Error ? err.message : "Agent run failed");
    } finally {
      setRunningAgent(null);
      startTransition(() => {});
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Job context</p>
            <h1 className="text-3xl font-semibold text-slate-900">{jobTitle}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <span className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-800 ring-1 ring-slate-200">
                📍 {jobLocation ?? "Location not provided"}
              </span>
              <StatusPill status="enabled" label={`${candidates.length} candidates`} />
              <Link
                href="/jobs"
                className="text-sm font-semibold text-indigo-700 underline decoration-indigo-200 underline-offset-4 hover:text-indigo-900"
              >
                Back to Jobs library
              </Link>
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 ring-1 ring-slate-200">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Must-have skills</p>
            {mustHaveSkills.length === 0 ? (
              <p className="text-sm text-slate-600">No must-have skills recorded.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {mustHaveSkills.map((skill) => (
                  <span key={skill} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800 ring-1 ring-indigo-200">
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Summary</p>
          <p className="mt-1 whitespace-pre-line leading-relaxed text-slate-800">
            {summary ?? "No summary captured for this job yet."}
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Execution controls</p>
            <h2 className="text-xl font-semibold text-slate-900">Run the MATCH → CONFIDENCE → EXPLAIN → SHORTLIST flow</h2>
            <AgentToggleNotice agents={agentState} modeLabel={modeLabel} />
            {modeDescription ? <p className="text-xs text-amber-700">{modeDescription}</p> : null}
          </div>
        </div>

        <ExecutionToolbar
          onRun={runAgent}
          disabled={disabled}
          running={runningAgent || (isPending ? runningAgent : null)}
          shortlistStrategy={shortlistStrategy}
          onShortlistStrategyChange={setShortlistStrategy}
        />

        <div className="flex flex-col gap-1 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200">
          {runningAgent ? (
            <p className="flex items-center gap-2 font-semibold text-indigo-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-500" aria-hidden />
              {runningAgent} agent is executing…
            </p>
          ) : (
            <p className="flex items-center gap-2 font-semibold text-slate-700">
              <span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden />
              Choose an agent to kick off the flow.
            </p>
          )}
          <p className="text-xs text-slate-500">Controls stay responsive while background work completes.</p>
        </div>

        {message ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 animate-pulse">
            <div className="flex items-center justify-between gap-3">
              <span>{message}</span>
              {lastUpdated ? (
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                  Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
        ) : null}
      </div>

      <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Results</p>
            <h3 className="text-lg font-semibold text-slate-900">Latest candidate runs</h3>
            <p className="text-sm text-slate-600">
              Run MATCH to populate scores, CONFIDENCE to classify reliability, EXPLAIN for recruiter-friendly summaries, and SHORTLIST to flag recommendations.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowShortlistedOnly((prev) => !prev)}
            className={clsx(
              "inline-flex items-center gap-2 self-start rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] ring-1",
              showShortlistedOnly
                ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                : "bg-slate-50 text-slate-700 ring-slate-200 hover:bg-slate-100",
            )}
            aria-pressed={showShortlistedOnly}
          >
            <span
              className={clsx(
                "h-2 w-2 rounded-full",
                showShortlistedOnly ? "bg-emerald-600" : "bg-slate-400",
              )}
              aria-hidden
            />
            Show shortlisted only
          </button>
        </div>

        <ResultsTable
          candidates={visibleCandidates}
          expandedId={expandedId}
          explainUnavailable={explainUnavailable}
          showShortlistedOnly={showShortlistedOnly}
          showFireDrillBadge={isFireDrillMode}
          onToggle={(id) => setExpandedId((prev) => (prev === id ? null : id))}
          decisionStates={decisionStates}
          onDecision={handleDecision}
          onViewed={handleViewed}
          receiptsByCandidate={receiptsByCandidate}
        />
      </div>
    </div>
  );
}
