"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import clsx from "clsx";

import { StatusPill } from "@/components/StatusPill";
import { SopContextualLink } from "@/components/SopContextualLink";
import { categorizeConfidence } from "@/app/jobs/[jobId]/matches/confidence";
import type { Explanation } from "@/lib/agents/explainEngine";
import {
  createDecisionStream,
  logDecisionStreamItem,
  type DecisionStreamAction,
  type DecisionStreamItem,
} from "@/lib/metrics/decisionStreamClient";
import { describeAssignment } from "@/lib/archetypes/reqArchetypes";
import { formatTradeoffDeclaration, resolveTradeoffs, type TradeoffDeclaration } from "@/lib/matching/tradeoffs";
import type { DecisionAuditContext, DecisionGovernanceSignals } from "@/server/decision/decisionReceipts";

export type AgentName = "MATCH" | "CONFIDENCE" | "EXPLAIN" | "SHORTLIST";

export type JobConsoleCandidate = {
  candidateId: string;
  candidateName: string;
  score: number | null;
  confidenceScore: number | null;
  confidenceBand: "HIGH" | "MEDIUM" | "LOW" | null;
  shortlisted: boolean;
  recommendedOutcome: "shortlist" | "pass";
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
  defaultTradeoffs: TradeoffDeclaration;
  showDecisionMomentCues?: boolean;
  archetype?: NonNullable<ReturnType<typeof describeAssignment>> | null;
  showSopContextualLink?: boolean;
  bullhornWritebackEnabled?: boolean;
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
  recommendation?: {
    recommendedOutcome?: "shortlist" | "pass";
    alignment?: "accept" | "override" | "disagree";
    rationale?: string | null;
  };
  standardizedTradeoff?: string | null;
  standardizedTradeoffKey?: string | null;
  standardizedRisks?: string[];
  standardizedRiskKeys?: string[];
  confidenceFrame?: "HIGH" | "MEDIUM" | "LOW" | null;
  archetype?: NonNullable<ReturnType<typeof describeAssignment>> | null;
  governance: DecisionGovernanceSignals;
  audit: DecisionAuditContext;
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
}
function toDecisionConfidence(candidate?: JobConsoleCandidate): { score: number; band: JobConsoleCandidate["confidenceBand"] } {
  const rawScore = candidate?.confidenceScore;
  const score = typeof rawScore === "number" ? rawScore : null;
  const normalized = score === null ? 5 : Math.min(10, Math.max(0, Number(((score > 10 ? score / 10 : score)).toFixed(2))));
  return { score: normalized, band: candidate?.confidenceBand ?? null };
}
type ChangeSource = AgentName | "MANUAL";

type RecommendationDelta = { label: string; from: string; to: string };

type RecommendationChange = {
  candidateId: string;
  candidateName: string;
  timestamp: string;
  agent: ChangeSource;
  inputChanged: string;
  assumptionShift: string;
  whyMoved: string;
  deltas: RecommendationDelta[];
};

type NarrativeHints = Partial<Pick<RecommendationChange, "inputChanged" | "assumptionShift" | "whyMoved">>;

function formatDeltaValue(value: unknown, options?: { shortlistLabel?: boolean }) {
  if (options?.shortlistLabel && typeof value === "boolean") {
    return value ? "Shortlisted" : "Not shortlisted";
  }

  if (typeof value === "number") return value.toString();
  if (typeof value === "string") return value;
  return "—";
}

function truncateSummary(summary?: string | null) {
  if (!summary) return "—";
  return summary.length > 80 ? `${summary.slice(0, 77)}…` : summary;
}

function collectDeltas(prev: JobConsoleCandidate, next: JobConsoleCandidate): RecommendationDelta[] {
  const deltas: RecommendationDelta[] = [];

  if (prev.score !== next.score) {
    deltas.push({
      label: "Match score",
      from: formatDeltaValue(prev.score),
      to: formatDeltaValue(next.score),
    });
  }

  if (prev.confidenceScore !== next.confidenceScore) {
    deltas.push({
      label: "Confidence",
      from: formatDeltaValue(prev.confidenceScore),
      to: formatDeltaValue(next.confidenceScore),
    });
  }

  if (prev.confidenceBand !== next.confidenceBand) {
    deltas.push({
      label: "Confidence band",
      from: formatDeltaValue(prev.confidenceBand),
      to: formatDeltaValue(next.confidenceBand),
    });
  }

  if (prev.shortlisted !== next.shortlisted) {
    deltas.push({
      label: "Shortlist status",
      from: formatDeltaValue(prev.shortlisted, { shortlistLabel: true }),
      to: formatDeltaValue(next.shortlisted, { shortlistLabel: true }),
    });
  }

  if (prev.explanation?.summary !== next.explanation?.summary && next.explanation?.summary) {
    deltas.push({
      label: "Explanation summary",
      from: truncateSummary(prev.explanation?.summary),
      to: truncateSummary(next.explanation.summary),
    });
  }

  return deltas;
}

function buildNarrative(agent: ChangeSource, deltas: RecommendationDelta[], shortlistStrategy: "quality" | "strict" | "fast", hints?: NarrativeHints) {
  const shortlistDelta = deltas.find((delta) => delta.label === "Shortlist status");
  const confidenceDelta = deltas.find((delta) => delta.label === "Confidence band");
  const scoreDelta = deltas.find((delta) => delta.label === "Match score");

  const defaultInputByAgent: Record<ChangeSource, string> = {
    MATCH: "MATCH recomputed candidate scores against the latest role signals.",
    CONFIDENCE: "CONFIDENCE recalculated reliability bands.",
    EXPLAIN: "EXPLAIN regenerated recruiter-facing context.",
    SHORTLIST: `SHORTLIST agent re-applied guardrails using the ${shortlistStrategy} strategy.`,
    MANUAL: "Manual override captured in the console.",
  };

  const defaultAssumptionByAgent: Record<ChangeSource, string> = {
    MATCH: "Signal weighting and job intent were refreshed.",
    CONFIDENCE: "Reliability thresholds shifted based on new signal mix.",
    EXPLAIN: "Narratives were rewritten with updated inputs.",
    SHORTLIST: "Guardrail boundaries and limits were enforced again.",
    MANUAL: "Recruiter intent superseded automated recommendations.",
  };

  const whyMoved =
    hints?.whyMoved ??
    (shortlistDelta
      ? `Recommendation ${shortlistDelta.to === "Shortlisted" ? "promoted to" : "removed from"} shortlist after ${agent.toLowerCase()} update.`
      : confidenceDelta
        ? "Confidence changed, adjusting recommendation strength."
        : scoreDelta
          ? "Match score shifted, impacting ranking."
          : "Recommendation refreshed.");

  return {
    inputChanged: hints?.inputChanged ?? defaultInputByAgent[agent],
    assumptionShift: hints?.assumptionShift ?? defaultAssumptionByAgent[agent],
    whyMoved,
  };
}

type RecommendationAlignment = "accept" | "override" | "disagree";
type DecisionAnnotation = { alignment: RecommendationAlignment; rationale: string };

function describeRecommendedOutcome(outcome: JobConsoleCandidate["recommendedOutcome"]): string {
  if (outcome === "shortlist") return "Shortlist recommended";
  if (outcome === "pass") return "Review without shortlist";
  return "Recommendation unavailable";
}

function actionAlignsWithRecommendation(outcome: JobConsoleCandidate["recommendedOutcome"], action: DecisionStreamAction): boolean {
  if (action === "VIEWED") return true;
  if (outcome === "shortlist") return action === "SHORTLISTED" || action === "FAVORITED";
  if (outcome === "pass") return action === "REMOVED";
  return true;
}

function deriveDefaultAnnotation(outcome: JobConsoleCandidate["recommendedOutcome"], action: DecisionStreamAction): DecisionAnnotation {
  const aligned = actionAlignsWithRecommendation(outcome, action);
  return { alignment: aligned ? "accept" : "override", rationale: "" };
}

function scrubSummaryForClient(summary?: string | null) {
  if (!summary) return "";
  const sentences = summary
    .split(".")
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .filter((sentence) => {
      const lower = sentence.toLowerCase();
      return !(
        lower.startsWith("drivers:") ||
        lower.startsWith("risks:") ||
        lower.includes("bullhorn") ||
        lower.includes("custom field payload") ||
        lower.includes("ats")
      );
    });

  return sentences.join(". ").trim();
}

type ClientTrustArtifact = {
  rationaleSummary: string;
  tradeoffsAccepted: string;
  confidenceFraming: string;
  monitoringPlan: string;
  clipboardText: string;
};

function buildClientTrustArtifact(receipt: DecisionReceipt): ClientTrustArtifact {
  const rationaleSummary =
    scrubSummaryForClient(receipt.summary) ||
    `${formatDecisionLabel(receipt.decisionType)} for ${receipt.candidateName}. Recruiter rationale is approved for client sharing.`;
  const tradeoffsAccepted = receipt.tradeoff ?? "Defaulted to recruiter judgment; no special tradeoffs recorded.";
  const normalizedConfidence = normalizeConfidenceToTenPoint(receipt.confidenceScore);
  const confidenceFraming =
    typeof normalizedConfidence === "number"
      ? `${normalizedConfidence.toFixed(1)}/10 confidence shared as directional context only.`
      : "Confidence not captured; share as recruiter-reviewed only.";
  const monitoringPlan =
    "Post-placement, we will monitor interview feedback and engagement. New signals will be logged without exposing internal scoring.";

  const clipboardText = [
    `Client Trust Artifact — ${formatDecisionLabel(receipt.decisionType)}`,
    `Rationale summary: ${rationaleSummary}`,
    `Tradeoffs accepted: ${tradeoffsAccepted}`,
    `Confidence framing: ${confidenceFraming}`,
    `Monitoring plan: ${monitoringPlan}`,
  ].join("\n");

  return {
    rationaleSummary,
    tradeoffsAccepted,
    confidenceFraming,
    monitoringPlan,
    clipboardText,
  };
}

function DecisionActions({
  state,
  onDecision,
  confidenceMissing,
}: {
  state: DecisionSnapshot;
  onDecision: (action: DecisionStreamAction) => void;
  confidenceMissing?: boolean;
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
    <div className="flex flex-col gap-1" aria-label="Decision actions">
      <div className="flex flex-wrap items-center gap-2">
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
      {confidenceMissing ? (
        <p className="text-[10px] text-slate-500">
          Confidence will be captured at 5/10 until a band is available. Add rationale to proceed.
        </p>
      ) : null}
    </div>
  );
}

type TradeoffKey = keyof TradeoffDeclaration;

function TradeoffSelector({
  value,
  onChange,
}: {
  value: TradeoffDeclaration;
  onChange: (key: TradeoffKey, option: string) => void;
}) {
  const options: Array<{
    key: TradeoffKey;
    label: string;
    choices: Array<{ value: TradeoffDeclaration[TradeoffKey]; label: string; hint: string }>;
  }> = [
    {
      key: "speedQuality",
      label: "Speed vs quality",
      choices: [
        { value: "speed", label: "Speed", hint: "Return candidates faster" },
        { value: "quality", label: "Quality", hint: "Favor deeper scoring" },
      ],
    },
    {
      key: "rateExperience",
      label: "Rate vs experience",
      choices: [
        { value: "rate", label: "Rate", hint: "Lean toward budget-friendly" },
        { value: "experience", label: "Experience", hint: "Prioritize seniority" },
      ],
    },
    {
      key: "availabilityFit",
      label: "Availability vs domain fit",
      choices: [
        { value: "availability", label: "Availability", hint: "Ready-to-start candidates" },
        { value: "domain_fit", label: "Domain fit", hint: "Closer domain alignment" },
      ],
    },
    {
      key: "riskUpside",
      label: "Risk vs upside",
      choices: [
        { value: "risk", label: "Risk controls", hint: "Raise bar for match score" },
        { value: "upside", label: "Upside", hint: "Allow stretch profiles" },
      ],
    },
  ];

  return (
    <div className="space-y-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">Tradeoff declaration</p>
          <p className="text-sm text-slate-700">Selections will be logged and applied before the MATCH run.</p>
        </div>
        <div className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700 ring-1 ring-slate-200">
          {formatTradeoffDeclaration(value)}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {options.map((option) => (
          <div key={option.key} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">{option.label}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {option.choices.map((choice) => {
                const active = value[option.key] === choice.value;
                return (
                  <label
                    key={choice.value}
                    className={clsx(
                      "flex cursor-pointer items-start gap-2 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] ring-1 transition",
                      active
                        ? "bg-indigo-100 text-indigo-900 ring-indigo-200"
                        : "bg-slate-50 text-slate-700 ring-slate-200 hover:bg-slate-100",
                    )}
                  >
                    <input
                      type="radio"
                      name={option.key}
                      value={choice.value}
                      checked={active}
                      onChange={() => onChange(option.key, choice.value)}
                      className="sr-only"
                    />
                    <div className="flex flex-col">
                      <span>{choice.label}</span>
                      <span className="text-[10px] font-normal capitalize tracking-normal text-slate-500">{choice.hint}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DecisionAlignmentSelector({
  candidateId,
  recommendedOutcome,
  annotation,
  error,
  onChange,
}: {
  candidateId: string;
  recommendedOutcome: JobConsoleCandidate["recommendedOutcome"];
  annotation: DecisionAnnotation;
  error?: string | null;
  onChange: (candidateId: string, annotation: DecisionAnnotation) => void;
}) {
  const options: Array<{ value: RecommendationAlignment; label: string; description: string }> = [
    { value: "accept", label: "Accept recommendation", description: "Outcome aligns with system guidance." },
    { value: "override", label: "Override recommendation", description: "Choose a different action." },
    { value: "disagree", label: "Disagree with rationale", description: "Decision aligns, but rationale is off." },
  ];

  const requiresReason = true;
  const placeholder =
    annotation.alignment === "disagree"
      ? "Why does the rationale miss? (required)"
      : annotation.alignment === "override"
        ? "Why are you overriding? (required)"
        : "What is the rationale for this decision? (required)";

  return (
    <div className="flex flex-col items-end gap-1 text-right">
      <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
        <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700 ring-1 ring-slate-200">
          {describeRecommendedOutcome(recommendedOutcome)}
        </span>
        <span className="text-slate-400">•</span>
        <span className="font-semibold">Decision response</span>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(candidateId, { ...annotation, alignment: option.value })}
            className={clsx(
              "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ring-1 transition",
              annotation.alignment === option.value
                ? "bg-indigo-50 text-indigo-800 ring-indigo-200"
                : "bg-slate-50 text-slate-600 ring-slate-200 hover:bg-slate-100",
            )}
            aria-pressed={annotation.alignment === option.value}
            title={option.description}
          >
            {option.label}
          </button>
        ))}
      </div>
      {requiresReason ? (
        <div className="w-full max-w-sm">
          <label className="sr-only" htmlFor={`decision-rationale-${candidateId}`}>
            Decision rationale for {candidateId}
          </label>
          <input
            id={`decision-rationale-${candidateId}`}
            type="text"
            value={annotation.rationale}
            onChange={(event) => onChange(candidateId, { ...annotation, rationale: event.target.value })}
            placeholder={placeholder}
            className={clsx(
              "w-full rounded-md border px-3 py-2 text-sm",
              error ? "border-rose-300 ring-rose-100" : "border-slate-200 ring-slate-100",
            )}
            maxLength={280}
            required
          />
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span className="font-semibold text-slate-600">Rationale required for every decision.</span>
            <span>{annotation.rationale.length}/280</span>
          </div>
        </div>
      ) : null}
      {error ? <p className="text-[11px] font-semibold text-rose-700">{error}</p> : null}
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
  annotations,
  onAnnotationChange,
  annotationErrors,
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
  annotations: Record<string, DecisionAnnotation>;
  onAnnotationChange: (candidateId: string, annotation: DecisionAnnotation) => void;
  annotationErrors: Record<string, string | null>;
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
                    <div className="flex flex-col items-end gap-3">
                      <DecisionAlignmentSelector
                        candidateId={candidate.candidateId}
                        recommendedOutcome={candidate.recommendedOutcome}
                        annotation={annotations[candidate.candidateId] ?? { alignment: "accept", rationale: "" }}
                        error={annotationErrors[candidate.candidateId]}
                        onChange={onAnnotationChange}
                      />
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <DecisionActions
                          state={decisionStates[candidate.candidateId] ?? DEFAULT_DECISION_STATE}
                          onDecision={(action) => onDecision(candidate, action)}
                          confidenceMissing={candidate.confidenceScore == null}
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

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = useCallback(async (text: string, receiptId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(receiptId);
      setTimeout(() => setCopiedId((prev) => (prev === receiptId ? null : prev)), 2000);
    } catch (error) {
      console.warn("Failed to copy client artifact", error);
      setCopiedId(null);
    }
  }, []);

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
          {receipt.recommendation ? (
            <p className="text-xs text-indigo-800">
              Recommendation: {describeRecommendedOutcome(receipt.recommendation.recommendedOutcome ?? "pass")} • Response:{" "}
              {receipt.recommendation.alignment ?? "accept"}
              {receipt.recommendation.rationale ? ` (${receipt.recommendation.rationale})` : ""}
            </p>
          ) : null}
          <p className="text-[11px] font-semibold text-indigo-700">
            Synced to Bullhorn as {receipt.bullhornTarget === "custom_field" ? "custom field payload" : "note"}.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span
              className={clsx(
                "rounded-full px-2 py-1 font-semibold ring-1",
                receipt.audit.chainValid
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : "bg-rose-50 text-rose-700 ring-rose-200",
              )}
            >
              Audit chain #{receipt.audit.chainPosition} {receipt.audit.chainValid ? "verified" : "check integrity"}
            </span>
            <span className="rounded-full bg-indigo-50 px-2 py-1 font-semibold text-indigo-800 ring-1 ring-indigo-200">
              Hash {receipt.audit.hash.slice(0, 10)}…
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700 ring-1 ring-slate-200">
              Overrides {Math.round(receipt.governance.overrideRate * 100)}% ({receipt.governance.overrideCount})
            </span>
            {receipt.governance.overconfidence ? (
              <span className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-700 ring-1 ring-amber-200">
                Overconfidence flagged
              </span>
            ) : null}
            {receipt.governance.repeatedOverrides ? (
              <span className="rounded-full bg-rose-50 px-2 py-1 font-semibold text-rose-700 ring-1 ring-rose-200">
                Repeated overrides
              </span>
            ) : null}
            {receipt.governance.missingSignals.length ? (
              <span className="rounded-full bg-rose-50 px-2 py-1 font-semibold text-rose-700 ring-1 ring-rose-200">
                Missing: {receipt.governance.missingSignals.join(", ")}
              </span>
            ) : (
              <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700 ring-1 ring-emerald-200">
                All required signals captured
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setExpandedId((prev) => (prev === receipt.id ? null : receipt.id))}
              className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-800 ring-1 ring-indigo-200 hover:bg-indigo-50"
            >
              {expandedId === receipt.id ? "Hide client artifact" : "Generate client artifact"}
            </button>
            <span className="text-[11px] text-slate-500">Opt-in only; formatted for client-safe sharing.</span>
          </div>

          {expandedId === receipt.id ? (
            <ClientTrustArtifactCard
              receipt={receipt}
              copied={copiedId === receipt.id}
              onCopy={(text) => handleCopy(text, receipt.id)}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ClientTrustArtifactCard({ receipt, copied, onCopy }: { receipt: DecisionReceipt; copied: boolean; onCopy: (text: string) => void }) {
  const artifact = buildClientTrustArtifact(receipt);

  return (
    <div className="mt-2 space-y-2 rounded-lg bg-white p-3 ring-1 ring-indigo-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-800">Client trust artifact</p>
        <button
          type="button"
          onClick={() => onCopy(artifact.clipboardText)}
          className={clsx(
            "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ring-1",
            copied ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-indigo-600 text-white ring-indigo-200 hover:bg-indigo-700",
          )}
        >
          {copied ? "Copied" : "Copy for client"}
        </button>
      </div>
      <ul className="list-disc space-y-1 pl-4 text-sm text-slate-800">
        <li>
          <span className="font-semibold text-slate-900">Rationale summary:</span> {artifact.rationaleSummary}
        </li>
        <li>
          <span className="font-semibold text-slate-900">Tradeoffs accepted:</span> {artifact.tradeoffsAccepted}
        </li>
        <li>
          <span className="font-semibold text-slate-900">Confidence framing:</span> {artifact.confidenceFraming}
        </li>
        <li>
          <span className="font-semibold text-slate-900">Monitoring plan:</span> {artifact.monitoringPlan}
        </li>
      </ul>
      <p className="text-[11px] text-slate-500">
        Client-safe formatting only includes approved narrative context—no drivers, risks, or internal systems are exposed.
      </p>
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

function RecommendationDiffPanel({ changes, onClear }: { changes: RecommendationChange[]; onClear: () => void }) {
  if (changes.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden />
          <p>No recommendation changes yet. Diffs will appear after the next run.</p>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">What changed?</p>
          <p className="text-sm text-indigo-900">Diff view of the latest recommendation shifts.</p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-semibold text-indigo-700 underline decoration-indigo-200 underline-offset-4 hover:text-indigo-900"
        >
          Clear history
        </button>
      </div>

      <div className="space-y-3">
        {changes.map((change) => (
          <article
            key={`${change.candidateId}-${change.timestamp}-${change.agent}`}
            className="space-y-2 rounded-xl bg-white p-3 text-sm text-indigo-900 ring-1 ring-indigo-100"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-0.5">
                <p className="text-base font-semibold leading-tight">{change.candidateName}</p>
                <p className="text-xs text-indigo-700">
                  {new Date(change.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • {change.agent}
                </p>
              </div>
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-800">
                Diff
              </span>
            </div>
            <p className="text-xs text-indigo-800">
              <span className="font-semibold">Input changed:</span> {change.inputChanged}
            </p>
            <p className="text-xs text-indigo-800">
              <span className="font-semibold">Assumption shift:</span> {change.assumptionShift}
            </p>
            <p className="text-xs text-indigo-800">
              <span className="font-semibold">Why moved:</span> {change.whyMoved}
            </p>
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-indigo-900">
              {change.deltas.map((delta) => (
                <span key={`${delta.label}-${delta.from}-${delta.to}-${change.timestamp}`} className="rounded-full bg-indigo-50 px-2 py-1 ring-1 ring-indigo-100">
                  {delta.label}: {delta.from} → {delta.to}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function JobExecutionConsole(props: JobConsoleProps) {
  const {
    jobId,
    jobTitle,
    jobLocation,
    summary,
    mustHaveSkills,
    initialCandidates,
    agentState,
    modeLabel,
    modeDescription,
    defaultTradeoffs,
    showDecisionMomentCues = false,
    archetype,
    showSopContextualLink = false,
    bullhornWritebackEnabled = false,
  } = props;
  const normalizeCandidate = (candidate: JobConsoleCandidate): JobConsoleCandidate => ({
    ...candidate,
    recommendedOutcome: candidate.recommendedOutcome ?? (candidate.shortlisted ? "shortlist" : "pass"),
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
  const [tradeoffs, setTradeoffs] = useState<TradeoffDeclaration>(defaultTradeoffs);
  const [changeLog, setChangeLog] = useState<RecommendationChange[]>([]);
  const [decisionAnnotations, setDecisionAnnotations] = useState<Record<string, DecisionAnnotation>>({});
  const [decisionAnnotationErrors, setDecisionAnnotationErrors] = useState<Record<string, string | null>>({});
  const [showBullhornNote, setShowBullhornNote] = useState(true);

  const storageKey = useMemo(() => `ete-job-console-${jobId}`, [jobId]);
  const tradeoffStorageKey = useMemo(() => `ete-job-console-tradeoffs-${jobId}`, [jobId]);
  const bullhornNoteStorageKey = useMemo(() => `ete-bullhorn-note-${jobId}`, [jobId]);

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

    if (decisionStreamId) return undefined;

    void (async () => {
      const streamId = await createDecisionStream(jobId, tradeoffs);
      if (!cancelled && streamId) {
        setDecisionStreamId(streamId);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [jobId, tradeoffs, decisionStreamId]);

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

  const recordRecommendationChanges = useCallback(
    (prev: JobConsoleCandidate[], next: JobConsoleCandidate[], agent: ChangeSource, hints?: NarrativeHints) => {
      if (prev.length === 0) return;

      const nextById = new Map(next.map((candidate) => [candidate.candidateId, candidate]));
      const updates: RecommendationChange[] = [];

      for (const previous of prev) {
        const current = nextById.get(previous.candidateId);
        if (!current) continue;

        const deltas = collectDeltas(previous, current);
        if (deltas.length === 0) continue;

        const narrative = buildNarrative(agent, deltas, shortlistStrategy, hints);

        updates.push({
          candidateId: current.candidateId,
          candidateName: current.candidateName,
          timestamp: new Date().toISOString(),
          agent,
          ...narrative,
          deltas,
        });
      }

      if (updates.length > 0) {
        setChangeLog((existing) => [...updates, ...existing].slice(0, 12));
      }
    },
    [shortlistStrategy],
  );

  const updateCandidatesWithDiff = useCallback(
    (agent: ChangeSource, updater: (prev: JobConsoleCandidate[]) => JobConsoleCandidate[], hints?: NarrativeHints) => {
      setCandidates((prev) => {
        const next = updater(prev);
        recordRecommendationChanges(prev, next, agent, hints);
        return next;
      });
    },
    [recordRecommendationChanges],
  );

  const dismissBullhornNote = useCallback(() => {
    setShowBullhornNote(false);
    try {
      sessionStorage.setItem(bullhornNoteStorageKey, "dismissed");
    } catch (err) {
      console.warn("Failed to persist bullhorn microcopy dismissal", err);
    }
  }, [bullhornNoteStorageKey]);

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(storageKey);
      let restored = false;
      if (cached) {
        const parsed = JSON.parse(cached) as JobConsoleCandidate[];
        setCandidates(parsed.map(normalizeCandidate));
        restored = true;
      }
      const cachedTradeoffs = sessionStorage.getItem(tradeoffStorageKey);
      if (cachedTradeoffs) {
        const parsed = JSON.parse(cachedTradeoffs) as Partial<TradeoffDeclaration>;
        setTradeoffs(resolveTradeoffs(defaultTradeoffs, parsed));
      }
      if (restored) return;
    } catch (err) {
      console.warn("Failed to read cached console data", err);
    }

    setCandidates(initialCandidates.map(normalizeCandidate));
    setTradeoffs(defaultTradeoffs);
  }, [storageKey, tradeoffStorageKey, initialCandidates, defaultTradeoffs]);

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(candidates));
    } catch (err) {
      console.warn("Failed to cache console data", err);
    }
  }, [candidates, storageKey]);

  useEffect(() => {
    try {
      sessionStorage.setItem(tradeoffStorageKey, JSON.stringify(tradeoffs));
    } catch (err) {
      console.warn("Failed to cache tradeoff selections", err);
    }
  }, [tradeoffs, tradeoffStorageKey]);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(bullhornNoteStorageKey);
      if (stored === "dismissed") {
        setShowBullhornNote(false);
      }
    } catch (err) {
      console.warn("Failed to read bullhorn microcopy state", err);
    }
  }, [bullhornNoteStorageKey]);

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
  const handleTradeoffChange = useCallback(
    (key: TradeoffKey, option: string) => {
      setTradeoffs((prev) => resolveTradeoffs(prev, { ...prev, [key]: option } as Partial<TradeoffDeclaration>));
    },
    [],
  );

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
    async (candidate: JobConsoleCandidate, action: DecisionStreamAction, annotation: DecisionAnnotation) => {
      const decisionType = mapDecisionActionToReceipt(action);
      if (!decisionType) return;

      const recommendation = {
        recommendedOutcome: candidate.recommendedOutcome,
        alignment: annotation.alignment,
        rationale: annotation.rationale.trim() || undefined,
      } as DecisionReceipt["recommendation"];
      const tradeoff = archetype?.defaultTradeoff ?? describeTradeoffFromStrategy(shortlistStrategy);
      const normalizedConfidence = normalizeConfidenceToTenPoint(candidate.confidenceScore ?? 5);

      const payload = {
        jobId,
        candidateId: candidate.candidateId,
        candidateName: candidate.candidateName,
        decisionType,
        drivers: candidate.explanation?.strengths?.slice(0, 3) ?? [],
        risks: candidate.explanation?.risks?.slice(0, 3) ?? [],
        confidenceScore: normalizedConfidence,
        summary: candidate.explanation?.summary ?? undefined,
        tradeoff,
        bullhornTarget: "note" as const,
        shortlistStrategy,
        recommendation,
        archetype: archetype
          ? {
              id: archetype.id,
              source: archetype.source ?? "auto",
              reason: archetype.reason,
              confidence: archetype.confidence,
            }
          : undefined,
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
    [appendReceipt, jobId, shortlistStrategy, archetype],
  );

  const handleDecision = useCallback(
    (candidate: JobConsoleCandidate, action: DecisionStreamAction) => {
      const labels: Record<DecisionStreamAction, string> = {
        VIEWED: "Viewed (new tab)",
        SHORTLISTED: "Shortlisted",
        REMOVED: "Removed from consideration",
        FAVORITED: "Favorited",
      };

      const existingAnnotation = decisionAnnotations[candidate.candidateId];
      const baseAnnotation = existingAnnotation ?? deriveDefaultAnnotation(candidate.recommendedOutcome, action);
      const normalizedAnnotation: DecisionAnnotation = actionAlignsWithRecommendation(candidate.recommendedOutcome, action) || baseAnnotation.alignment !== "accept"
        ? baseAnnotation
        : { ...baseAnnotation, alignment: "override" };
      const rationale = (normalizedAnnotation.rationale ?? "").trim();

      if (rationale.length === 0) {
        setDecisionAnnotations((prev) => ({ ...prev, [candidate.candidateId]: normalizedAnnotation }));
        setDecisionAnnotationErrors((prev) => ({
          ...prev,
          [candidate.candidateId]: "Add a short rationale before recording this decision.",
        }));
        return;
      }

      setDecisionAnnotationErrors((prev) => ({ ...prev, [candidate.candidateId]: null }));
      setDecisionAnnotations((prev) => ({ ...prev, [candidate.candidateId]: normalizedAnnotation }));

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
        updateCandidatesWithDiff(
          "MANUAL",
          (prev) => prev.map((row) => (row.candidateId === candidate.candidateId ? { ...row, shortlisted: true } : row)),
          { whyMoved: "Recruiter manually promoted this candidate to the shortlist." },
        );
      }

      if (action === "REMOVED") {
        updateCandidatesWithDiff(
          "MANUAL",
          (prev) => prev.map((row) => (row.candidateId === candidate.candidateId ? { ...row, shortlisted: false } : row)),
          { whyMoved: "Recruiter removed this candidate from the shortlist." },
        );
      }

      void persistDecisionReceipt(candidate, action, normalizedAnnotation);

      logDecision({
        action,
        candidateId: candidate.candidateId,
        label: labels[action],
        details: {
          candidateName: candidate.candidateName,
          recommendedOutcome: candidate.recommendedOutcome,
          recommendationAlignment: normalizedAnnotation.alignment,
          recommendationRationale: rationale || undefined,
        },
      });
    },
    [decisionAnnotations, logDecision, persistDecisionReceipt, updateCandidatesWithDiff],
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
        const res = await fetch(`/api/agents/match`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobReqId: jobId, tradeoffs }),
        });
        if (!res.ok) throw new Error(`MATCH failed with ${res.status}`);
        const payload = (await res.json()) as {
          matches: Array<{
            candidateId: string;
            score: number;
            confidence: number;
            confidenceCategory?: string;
            explanation?: string;
          }>;
        };

        updateCandidatesWithDiff(
          "MATCH",
          (prev) => {
            const byId = new Map(prev.map((row) => [row.candidateId, row]));

            for (const match of payload.matches) {
              const existing = byId.get(match.candidateId);
              const updated: JobConsoleCandidate = {
                candidateId: match.candidateId,
                candidateName: existing?.candidateName ?? `Candidate ${match.candidateId.slice(0, 6)}`,
                score: Math.round(match.score),
                confidenceScore: Math.round(match.confidence),
                confidenceBand: normalizeBand(match.confidenceCategory) ?? normalizeBand(categorizeConfidence(match.confidence)),
                shortlisted: existing?.shortlisted ?? false,
                recommendedOutcome: existing?.recommendedOutcome ?? (existing?.shortlisted ? "shortlist" : "pass"),
                explanation:
                  existing?.explanation ?? normalizeExplanation(match.explanation ?? "Explanation not generated yet.", { summaryOnly: true }),
              };

              byId.set(match.candidateId, updated);
            }

            return Array.from(byId.values()).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
          },
          {
            inputChanged: "MATCH recomputed scores using the latest job signals.",
            assumptionShift: "Candidate similarity recalculated against refreshed role intent.",
          },
        );

        setMessage(`MATCH completed. ${formatTradeoffDeclaration(tradeoffs)}.`);
        setLastUpdated(new Date());
      }

      if (agent === "CONFIDENCE") {
        const res = await fetch(`/api/jobs/${jobId}/confidence`, { method: "POST" });
        if (!res.ok) throw new Error(`CONFIDENCE failed with ${res.status}`);
        const payload = (await res.json()) as {
          results: Array<{ candidateId: string; score: number; confidenceBand: string }>;
        };

        updateCandidatesWithDiff(
          "CONFIDENCE",
          (prev) =>
            prev.map((row) => {
              const updated = payload.results.find((entry) => entry.candidateId === row.candidateId);
              if (!updated) return row;
              const band = normalizeBand(updated.confidenceBand);
              const confidenceScore = updated.score <= 1 ? Math.round(updated.score * 100) : Math.round(updated.score);
              return { ...row, confidenceScore, confidenceBand: band };
            }),
          { inputChanged: "CONFIDENCE refreshed reliability scores using the latest signals." },
        );

        setMessage("Confidence bands refreshed.");
        setLastUpdated(new Date());
      }

      if (agent === "EXPLAIN") {
        const res = await fetch(`/api/jobs/${jobId}/explain`, { method: "POST" });
        if (!res.ok) throw new Error(`EXPLAIN failed with ${res.status}`);
        const payload = (await res.json()) as { explanations: Array<{ candidateId: string; explanation: Explanation }> };

        updateCandidatesWithDiff(
          "EXPLAIN",
          (prev) =>
            prev.map((row) => {
              const explanation = payload.explanations.find((entry) => entry.candidateId === row.candidateId);
              if (!explanation) return row;
              return { ...row, explanation: normalizeExplanation(explanation.explanation, { summaryOnly: false }) };
            }),
          { inputChanged: "EXPLAIN regenerated recruiter-facing reasoning for each candidate." },
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

        updateCandidatesWithDiff(
          "SHORTLIST",
          (prev) => prev.map((row) => ({ ...row, shortlisted: shortlistedIds.has(row.candidateId) })),
          {
            whyMoved: `Shortlist recomputed with ${shortlistStrategy} strategy (${payload.totalMatches} matches evaluated).`,
          },
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
          <div className="rounded-2xl bg-indigo-50 p-4 text-sm text-indigo-800 ring-1 ring-indigo-100">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-600">Req archetype</p>
            {archetype ? (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-800 ring-1 ring-indigo-200">
                    {archetype.label}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-700">
                    Default tradeoff: {archetype.defaultTradeoff}
                  </span>
                </div>
                <p className="text-xs text-indigo-700">{archetype.explainCue}</p>
              </div>
            ) : (
              <p className="text-xs text-indigo-700">No archetype assigned yet.</p>
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

        <TradeoffSelector value={tradeoffs} onChange={handleTradeoffChange} />

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Results</p>
            <h3 className="text-lg font-semibold text-slate-900">Latest candidate runs</h3>
            <p className="text-sm text-slate-600">
              Run MATCH to populate scores, CONFIDENCE to classify reliability, EXPLAIN for recruiter-friendly summaries, and SHORTLIST to flag recommendations.
            </p>
            {showDecisionMomentCues ? (
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-800 ring-1 ring-indigo-200">
                <span className="h-2 w-2 rounded-full bg-indigo-500" aria-hidden />
                Decision moment — rationale and confidence will be recorded
              </div>
            ) : null}
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            {showSopContextualLink ? <SopContextualLink context="submission" /> : null}
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
        </div>

        {showBullhornNote ? (
          <div className="flex flex-wrap items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
            <span className="rounded-full bg-indigo-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-800">
              Bullhorn
            </span>
            <p className="flex-1 text-sm text-slate-800">
              {bullhornWritebackEnabled
                ? "This outcome will be recorded in Bullhorn as the system of record."
                : "This outcome will be available for recording in Bullhorn (system of record)."}
            </p>
            <button
              type="button"
              onClick={dismissBullhornNote}
              className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
            >
              Got it
            </button>
          </div>
        ) : null}

        {showDecisionMomentCues && visibleCandidates.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
            <div className="flex items-center gap-2 font-semibold">
              <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-600" aria-hidden />
              You are entering a decision moment
            </div>
            <ul className="list-disc space-y-1 pl-5 text-indigo-900/80">
              <li>Reasoning will be saved</li>
              <li>Outcome will sync back to Bullhorn</li>
            </ul>
          </div>
        ) : null}

        <RecommendationDiffPanel changes={changeLog} onClear={() => setChangeLog([])} />

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
          annotations={decisionAnnotations}
          annotationErrors={decisionAnnotationErrors}
          onAnnotationChange={(candidateId, annotation) => {
            setDecisionAnnotations((prev) => ({ ...prev, [candidateId]: annotation }));
            setDecisionAnnotationErrors((prev) => ({ ...prev, [candidateId]: null }));
          }}
        />
      </div>
    </div>
  );
}
