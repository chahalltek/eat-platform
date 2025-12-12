"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import clsx from "clsx";

import { StatusPill } from "@/components/StatusPill";
import { categorizeConfidence } from "@/app/jobs/[jobId]/matches/confidence";

export type AgentName = "MATCH" | "CONFIDENCE" | "EXPLAIN" | "SHORTLIST";

export type JobConsoleCandidate = {
  candidateId: string;
  candidateName: string;
  score: number | null;
  confidenceScore: number | null;
  confidenceBand: "HIGH" | "MEDIUM" | "LOW" | null;
  shortlisted: boolean;
  explanation: string;
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

function ResultsTable({
  candidates,
  expandedId,
  onToggle,
}: {
  candidates: JobConsoleCandidate[];
  expandedId: string | null;
  onToggle: (id: string) => void;
}) {
  if (candidates.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-6 py-10 text-center shadow-sm">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 ring-1 ring-slate-200">
            <span className="h-2 w-2 rounded-full bg-indigo-400" aria-hidden />
            No candidates yet
          </div>
          <h3 className="text-xl font-semibold text-slate-900">Waiting for a MATCH run</h3>
          <p className="max-w-lg text-sm leading-relaxed text-slate-600">
            Kick off MATCH to pull candidates into the console. Confidence, explanations, and shortlist actions will unlock as soon as results arrive.
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

              return (
                <>
                  <tr key={candidate.candidateId} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-semibold text-slate-900">{candidate.candidateName}</td>
                    <td className="px-4 py-3">
                      {typeof candidate.score === "number" ? `${candidate.score}%` : <span className="text-slate-500">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <ConfidenceBadge band={candidate.confidenceBand} />
                    </td>
                    <td className="px-4 py-3">
                      {candidate.shortlisted ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                          Yes
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onToggle(candidate.candidateId)}
                        className="text-sm font-semibold text-indigo-700 underline decoration-indigo-200 underline-offset-4 hover:text-indigo-900"
                      >
                        {expanded ? "Hide explanation" : "View explanation"}
                      </button>
                    </td>
                  </tr>
                  {expanded ? (
                    <tr className="bg-indigo-50/40" key={`${candidate.candidateId}-explanation`}>
                      <td colSpan={5} className="px-4 py-4 text-sm text-slate-800">
                        {candidate.explanation}
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

function ExecutionToolbar({
  onRun,
  disabled,
  running,
}: {
  onRun: (agent: AgentName) => void;
  disabled: Record<AgentName, boolean>;
  running: AgentName | null;
}) {
  const buttonClasses = {
    MATCH: "bg-slate-900 text-white",
    CONFIDENCE: "bg-indigo-50 text-indigo-900 ring-1 ring-indigo-200",
    EXPLAIN: "bg-slate-100 text-slate-900",
    SHORTLIST: "bg-emerald-600 text-white",
  } as const;

  const labels: Record<AgentName, string> = {
    MATCH: "Run MATCH",
    CONFIDENCE: "Run CONFIDENCE",
    EXPLAIN: "Run EXPLAIN",
    SHORTLIST: "Run SHORTLIST",
  };

  return (
    <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      {(Object.keys(labels) as AgentName[]).map((agent) => {
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
  );
}

export function JobExecutionConsole(props: JobConsoleProps) {
  const { jobId, jobTitle, jobLocation, summary, mustHaveSkills, initialCandidates, agentState, modeLabel, modeDescription } =
    props;
  const [candidates, setCandidates] = useState<JobConsoleCandidate[]>(initialCandidates);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [runningAgent, setRunningAgent] = useState<AgentName | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const storageKey = useMemo(() => `ete-job-console-${jobId}`, [jobId]);

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(storageKey);
      if (cached) {
        const parsed = JSON.parse(cached) as JobConsoleCandidate[];
        setCandidates(parsed);
        return;
      }
    } catch (err) {
      console.warn("Failed to read cached console data", err);
    }

    setCandidates(initialCandidates);
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
              explanation: existing?.explanation ?? "Explanation not generated yet.",
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
        const payload = (await res.json()) as { recomputed: Array<{ candidateId: string; confidence: number }> };

        setCandidates((prev) =>
          prev.map((row) => {
            const updated = payload.recomputed.find((entry) => entry.candidateId === row.candidateId);
            if (!updated) return row;
            const band = normalizeBand(categorizeConfidence(updated.confidence));
            return { ...row, confidenceScore: Math.round(updated.confidence), confidenceBand: band };
          }),
        );

        setMessage("Confidence bands refreshed.");
        setLastUpdated(new Date());
      }

      if (agent === "EXPLAIN") {
        const res = await fetch(`/api/jobs/${jobId}/explain`, { method: "POST" });
        if (!res.ok) throw new Error(`EXPLAIN failed with ${res.status}`);
        const payload = (await res.json()) as { explanations: Array<{ candidateId: string; explanation: string }> };

        setCandidates((prev) =>
          prev.map((row) => {
            const explanation = payload.explanations.find((entry) => entry.candidateId === row.candidateId);
            if (!explanation) return row;
            return { ...row, explanation: explanation.explanation };
          }),
        );

        setMessage("Explain summaries updated.");
        setLastUpdated(new Date());
      }

      if (agent === "SHORTLIST") {
        const res = await fetch(`/api/jobs/${jobId}/shortlist`, { method: "POST" });
        if (!res.ok) throw new Error(`SHORTLIST failed with ${res.status}`);
        const payload = (await res.json()) as {
          shortlistedCandidates: Array<{ candidateId: string }>;
          totalMatches: number;
        };

        const shortlistedIds = new Set(payload.shortlistedCandidates.map((entry) => entry.candidateId));

        setCandidates((prev) =>
          prev.map((row) => ({ ...row, shortlisted: shortlistedIds.has(row.candidateId) })),
        );

        setMessage("Shortlist updated.");
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

        <ExecutionToolbar onRun={runAgent} disabled={disabled} running={runningAgent || (isPending ? runningAgent : null)} />

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
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Results</p>
            <h3 className="text-lg font-semibold text-slate-900">Latest candidate runs</h3>
            <p className="text-sm text-slate-600">
              Run MATCH to populate scores, CONFIDENCE to classify reliability, EXPLAIN for recruiter-friendly summaries, and SHORTLIST to flag recommendations.
            </p>
          </div>
        </div>

        <ResultsTable candidates={candidates} expandedId={expandedId} onToggle={(id) => setExpandedId((prev) => (prev === id ? null : id))} />
      </div>
    </div>
  );
}
