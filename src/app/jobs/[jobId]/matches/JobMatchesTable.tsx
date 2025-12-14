"use client";

import { useCallback, useMemo, useState } from "react";
import type { FilterFn } from "@tanstack/react-table";

import { StandardTable } from "@/components/table/StandardTable";
import { TableSearchInput } from "@/components/table/TableSearchInput";
import type { ETETableColumn } from "@/components/table/tableTypes";
import { createNumberColumn, createTextColumn } from "@/components/table/tableTypes";
import { JobCandidateStatus } from "@/server/db";

import { MatchFeedbackControls } from "./MatchFeedbackControls";
import { JobCandidateStatusControl } from "./JobCandidateStatusControl";
import { HiringOutcomeControl } from "./HiringOutcomeControl";
import { OutreachGenerator } from "./OutreachGenerator";
import { ShortlistActions } from "./ShortlistActions";
import type { CandidateSignalBreakdown } from "@/lib/matching/candidateSignals";
import { normalizeMatchExplanation } from "@/lib/matching/explanation";
import { LOW_CONFIDENCE_THRESHOLD, categorizeConfidence } from "./confidence";
import { logRecruiterBehavior } from "@/lib/metrics/recruiterBehaviorClient";
import { buildJustification } from "@/lib/agents/justificationEngine";
import type { JustificationInput } from "@/lib/agents/justificationEngine";
import type { ConfidenceBand } from "@/lib/agents/confidenceEngine.v2";
import { type HiringOutcomeStatus } from "@/lib/hiringOutcomes";

export type MatchRow = {
  id: string;
  candidateId: string;
  jobId: string;
  jobTitle?: string;
  candidateName: string;
  candidateEmail?: string | null;
  currentTitle?: string | null;
  score?: number | null;
  category?: string | null;
  jobCandidateId?: string;
  jobCandidateStatus?: JobCandidateStatus;
  jobCandidateNotes?: string | null;
  hiringOutcomeStatus?: HiringOutcomeStatus;
  hiringOutcomeSource?: string | null;
  explanation?: unknown;
  skillScore?: number | null;
  seniorityScore?: number | null;
  locationScore?: number | null;
  candidateSignalScore?: number | null;
  candidateSignalBreakdown?: CandidateSignalBreakdown | null;
  keySkills?: string[];
  jobSkills?: string[];
  candidateLocation?: string | null;
  confidenceScore?: number | null;
  confidenceCategory?: "High" | "Medium" | "Low";
  confidenceReasons?: string[];
  shortlisted?: boolean;
  shortlistReason?: string | null;
};

type ShortlistState = { shortlisted: boolean; reason: string };

const globalFilterFn: FilterFn<MatchRow> = (row, _columnId, filterValue) => {
  const query = typeof filterValue === "string" ? filterValue.trim().toLowerCase() : "";
  if (!query) return true;
  const values = [row.original.candidateName, row.original.currentTitle ?? ""];
  return values.some((value) => value.toString().toLowerCase().includes(query));
};

type JustificationState = "idle" | "loading" | "success" | "error";

export function JobMatchesTable({ matches, jobTitle, jobId }: { matches: MatchRow[]; jobTitle: string; jobId: string }) {
  const [shortlistState, setShortlistState] = useState<Map<string, ShortlistState>>(
    () =>
      new Map(
        matches.map((match) => [
          match.id,
          { shortlisted: match.shortlisted ?? false, reason: match.shortlistReason ?? "" },
        ]),
      ),
  );
  const [shortlistErrors, setShortlistErrors] = useState<Map<string, string>>(new Map());
  const [savingShortlists, setSavingShortlists] = useState<Set<string>>(new Set());
  const [hideLowConfidence, setHideLowConfidence] = useState(false);
  const [showShortlistedOnly, setShowShortlistedOnly] = useState(false);

  const [explainTarget, setExplainTarget] = useState<MatchRow | null>(null);
  const [explainResult, setExplainResult] = useState<ReturnType<typeof normalizeMatchExplanation> | null>(null);
  const [isExplainOpen, setIsExplainOpen] = useState(false);
  const [isExplainLoading, setIsExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [justificationStates, setJustificationStates] = useState<Record<string, JustificationState>>({});

  const shortlistStateFor = useCallback(
    (matchId: string): ShortlistState => {
      const existing = shortlistState.get(matchId);
      return existing ?? { shortlisted: false, reason: "" };
    },
    [shortlistState],
  );

  const updateShortlistState = useCallback((matchId: string, nextState: ShortlistState) => {
    setShortlistState((current) => {
      const next = new Map(current);
      next.set(matchId, nextState);
      return next;
    });
  }, []);

  const updateShortlistReason = useCallback((matchId: string, reason: string) => {
    setShortlistState((current) => {
      const next = new Map(current);
      const existing = next.get(matchId) ?? { shortlisted: false, reason: "" };
      next.set(matchId, { ...existing, reason });
      return next;
    });
  }, []);

  const persistShortlistState = useCallback(
    async (matchId: string, overrideState?: ShortlistState) => {
      const state = overrideState ?? shortlistStateFor(matchId);

      setSavingShortlists((current) => new Set(current).add(matchId));
      setShortlistErrors((current) => {
        const next = new Map(current);
        next.delete(matchId);
        return next;
      });

      try {
        const response = await fetch("/api/agents/shortlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matchId,
            shortlisted: state.shortlisted,
            reason: state.reason,
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: "Unable to update shortlist" }));
          throw new Error(error.error ?? "Unable to update shortlist");
        }

        const payload = (await response.json()) as { shortlisted: boolean; shortlistReason: string | null };

        updateShortlistState(matchId, {
          shortlisted: payload.shortlisted,
          reason: payload.shortlistReason ?? "",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to update shortlist";

        setShortlistErrors((current) => {
          const next = new Map(current);
          next.set(matchId, message);
          return next;
        });

        updateShortlistState(matchId, shortlistStateFor(matchId));
      } finally {
        setSavingShortlists((current) => {
          const next = new Set(current);
          next.delete(matchId);
          return next;
        });
      }
    },
    [shortlistStateFor, updateShortlistState],
  );

  const handleShortlistToggle = useCallback(
    (match: MatchRow, shortlisted: boolean) => {
      const nextState = { ...shortlistStateFor(match.id), shortlisted };

      if (nextState.shortlisted !== shortlistStateFor(match.id).shortlisted) {
        void logRecruiterBehavior({
          action: "SHORTLIST_OVERRIDE",
          jobId: match.jobId,
          matchId: match.id,
          candidateId: match.candidateId,
          confidence: match.confidenceCategory ?? categorizeConfidence(match.confidenceScore),
          details: {
            from: shortlistStateFor(match.id).shortlisted,
            to: shortlisted,
            jobTitle: match.jobTitle,
          },
        });
      }

      updateShortlistState(match.id, nextState);
      void persistShortlistState(match.id, nextState);
    },
    [persistShortlistState, shortlistStateFor, updateShortlistState],
  );

  const handleShortlistSave = useCallback(
    (matchId: string) => {
      void persistShortlistState(matchId);
    },
    [persistShortlistState],
  );

  const matchesWithShortlist = useMemo(
    () =>
      matches.map((match) => {
        const shortlist = shortlistState.get(match.id);
        return {
          ...match,
          shortlisted: shortlist?.shortlisted ?? match.shortlisted ?? false,
          shortlistReason: shortlist?.reason ?? match.shortlistReason ?? "",
        };
      }),
    [matches, shortlistState],
  );

  const handleExplain = useCallback(
    async (match: MatchRow) => {
      setExplainTarget(match);
      setExplainResult(null);
      setExplainError(null);
      setIsExplainOpen(true);
      setIsExplainLoading(true);

      try {
        const response = await fetch("/api/agents/explain", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            matchId: match.id,
          }),
        });

        const payload = (await response.json()) as { explanation?: unknown; error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to fetch explanation");
        }

        setExplainResult(normalizeMatchExplanation(payload.explanation));
      } catch (err) {
        console.error("Explain agent failed", err);
        setExplainError(err instanceof Error ? err.message : "Failed to fetch explanation");
      } finally {
        setIsExplainLoading(false);
      }
    },
    [],
  );

  const filteredMatches = useMemo(() => {
    let scopedMatches = matchesWithShortlist;

    if (hideLowConfidence) {
      scopedMatches = scopedMatches.filter((match) => {
        const category = match.confidenceCategory ?? categorizeConfidence(match.confidenceScore);
        return category !== "Low" || (match.confidenceScore ?? 0) >= LOW_CONFIDENCE_THRESHOLD;
      });
    }

    if (showShortlistedOnly) {
      scopedMatches = scopedMatches.filter((match) => match.shortlisted);
    }

    return scopedMatches;
  }, [hideLowConfidence, matchesWithShortlist, showShortlistedOnly]);

  const setJustificationState = useCallback((matchId: string, state: JustificationState) => {
    setJustificationStates((current) => ({ ...current, [matchId]: state }));
  }, []);

  const buildJustificationInput = useCallback(
    (match: MatchRow): JustificationInput => {
      const confidenceBand = (match.confidenceCategory ?? categorizeConfidence(match.confidenceScore))?.toUpperCase() as
        | ConfidenceBand
        | undefined;

      return {
        job: {
          id: match.jobId,
          title: match.jobTitle ?? match.jobId,
          skills: (match.jobSkills ?? []).map((skill) => ({ name: skill })),
          location: match.candidateLocation,
          seniorityLevel: match.jobCandidateStatus,
        },
        candidate: {
          id: match.candidateId,
          name: match.candidateName,
          location: match.candidateLocation,
          seniorityLevel: match.category,
          skills: (match.keySkills ?? []).map((skill) => ({ name: skill })),
        },
        match: {
          candidateId: match.candidateId,
          score: typeof match.score === "number" ? match.score : 0,
          signals: {
            mustHaveSkillsCoverage: 0.5,
            niceToHaveSkillsCoverage: 0.5,
            experienceAlignment: 0.5,
            locationAlignment: match.candidateLocation ? 0.6 : 0.5,
          },
        },
        confidence:
          confidenceBand && typeof match.confidenceScore === "number"
            ? { band: confidenceBand, reasons: match.confidenceReasons ?? [], candidateId: match.candidateId, score: match.confidenceScore }
            : undefined,
        explanation: match.explanation as JustificationInput["explanation"],
      };
    },
    [],
  );

  const handleCopyJustification = useCallback(
    async (match: MatchRow) => {
      setJustificationState(match.id, "loading");

      try {
        if (!navigator?.clipboard?.writeText) {
          throw new Error("Clipboard API not available");
        }

        const justification = buildJustification(buildJustificationInput(match));
        await navigator.clipboard.writeText(`${justification.subject}\n\n${justification.body}`);
        setJustificationState(match.id, "success");
      } catch (error) {
        console.error("Failed to copy justification", error);
        setJustificationState(match.id, "error");
      }
    },
    [buildJustificationInput, setJustificationState],
  );

  const columns = useMemo<ETETableColumn<MatchRow>[]>(
    () => [
      {
        id: "shortlist",
        header: "Shortlist",
        enableSorting: false,
        cell: ({ row }) => {
          const shortlist = shortlistStateFor(row.original.id);
          const isSaving = savingShortlists.has(row.original.id);
          const error = shortlistErrors.get(row.original.id);

          return (
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2 font-medium text-gray-700">
                  <input
                    type="checkbox"
                    aria-label={`Shortlist ${row.original.candidateName}`}
                    checked={shortlist.shortlisted}
                  onChange={(event) => handleShortlistToggle(row.original, event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={isSaving}
                  />
                <span>Shortlist</span>
              </label>

              <div className="space-y-1">
                <label className="sr-only" htmlFor={`shortlist-reason-${row.id}`}>
                  Shortlist reason for {row.original.candidateName}
                </label>
                <input
                  id={`shortlist-reason-${row.id}`}
                  type="text"
                  value={shortlist.reason}
                  placeholder="Add reason (optional)"
                  onChange={(event) => updateShortlistReason(row.original.id, event.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                  disabled={isSaving}
                />
                <div className="flex items-center justify-between text-[11px]">
                  {error ? (
                    <span className="text-red-700">{error}</span>
                  ) : (
                    <span className="text-gray-500">Optional context</span>
                  )}
                  <div className="flex items-center gap-2">
                    {isSaving ? <span className="text-gray-500">Saving…</span> : null}
                    <button
                      type="button"
                      onClick={() => handleShortlistSave(row.original.id)}
                      className="rounded bg-blue-600 px-2 py-1 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                      disabled={isSaving}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        },
      },
      {
        ...createTextColumn<MatchRow, "candidateName">({
          accessorKey: "candidateName",
          header: "Candidate",
        }),
        cell: ({ row }) => (
          <div className="space-y-1">
            <div className="font-semibold text-gray-900">{row.original.candidateName}</div>
            <div className="text-sm text-gray-700">{row.original.currentTitle ?? ""}</div>
            <div className="text-xs text-gray-500">{row.original.candidateEmail ?? "No email"}</div>
          </div>
        ),
      },
      createTextColumn<MatchRow, "jobTitle">({
        accessorKey: "jobTitle",
        header: "Job title",
        sortable: false,
        cell: ({ getValue }) => <span className="text-sm text-gray-800">{getValue() ?? "Title not provided"}</span>,
      }),
      {
        ...createNumberColumn<MatchRow, "score">({
          accessorKey: "score",
          header: "Score",
          sortable: true,
        }),
        cell: ({ getValue }) => {
          const value = getValue<number | null>();
          return <span className="text-sm font-semibold text-gray-900">{value ?? "—"}</span>;
        },
      },
      {
        id: "confidence",
        header: "Confidence",
        enableSorting: false,
        cell: ({ row }) => <ConfidenceCell match={row.original} />,
      },
      {
        id: "feedback",
        header: "Feedback",
        enableSorting: false,
        cell: ({ row }) => (
          <MatchFeedbackControls matchId={row.original.id} candidateName={row.original.candidateName} />
        ),
      },
      {
        id: "outcome",
        header: "Outcome",
        enableSorting: false,
        cell: ({ row }) => (
          <HiringOutcomeControl
            jobId={row.original.jobId}
            candidateId={row.original.candidateId}
            initialStatus={row.original.hiringOutcomeStatus}
          />
        ),
      },
      {
        id: "status",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.jobCandidateId ? (
            <JobCandidateStatusControl
              jobCandidateId={row.original.jobCandidateId}
              initialStatus={row.original.jobCandidateStatus as JobCandidateStatus}
            />
          ) : (
            <span className="text-xs text-gray-500">No status available</span>
          ),
      },
      {
        id: "outreach",
        header: "Outreach",
        enableSorting: false,
        cell: ({ row }) => <OutreachGenerator candidateId={row.original.candidateId} jobReqId={row.original.jobId} />,
      },
      {
        id: "explanation",
        header: "Explainability",
        enableSorting: false,
        cell: ({ row }) => <ExplainabilityCell match={row.original} onExplain={() => handleExplain(row.original)} />,
      },
      {
        id: "explainAgent",
        header: "Explain",
        enableSorting: false,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => handleExplain(row.original)}
            className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 hover:border-blue-300 hover:bg-blue-100"
          >
            Explain
          </button>
        ),
      },
      {
        id: "justification",
        header: "Justification",
        enableSorting: false,
        cell: ({ row }) => {
          const status = justificationStates[row.original.id] ?? "idle";
          return (
            <button
              type="button"
              onClick={() => void handleCopyJustification(row.original)}
              className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800 transition hover:border-indigo-300 hover:bg-indigo-100"
            >
              {status === "success" ? "Copied" : status === "loading" ? "Copying…" : "Copy justification"}
            </button>
          );
        },
      },
    ],
    [
      handleCopyJustification,
      handleExplain,
      handleShortlistSave,
      handleShortlistToggle,
      justificationStates,
      savingShortlists,
      shortlistErrors,
      shortlistStateFor,
      updateShortlistReason,
    ],
  );

  return (
    <>
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
        <ShortlistActions jobId={jobId} matches={filteredMatches} />
      </div>
      <StandardTable
        data={filteredMatches}
        columns={columns}
        sorting={{ initialState: [{ id: "score", desc: true }] }}
        filtering={{ globalFilter: { initialState: "" }, globalFilterFn }}
        renderToolbar={(table) => (
          <>
            <TableSearchInput table={table} placeholder="Search candidates" label="Search" />
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={hideLowConfidence}
                onChange={(event) => setHideLowConfidence(event.target.checked)}
              />
              Hide low-confidence matches
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={showShortlistedOnly}
                onChange={(event) => setShowShortlistedOnly(event.target.checked)}
              />
              Show shortlisted only
            </label>
          </>
        )}
        emptyState={<p className="px-6 py-8 text-center text-sm text-gray-700">No matches found for this job yet.</p>}
      />

      {isExplainOpen && explainTarget ? (
        <ExplainAgentPanel
          isLoading={isExplainLoading}
          result={explainResult}
          match={explainTarget}
          onClose={() => {
            setIsExplainOpen(false);
            setExplainResult(null);
            setExplainError(null);
          }}
          error={explainError}
          jobTitle={jobTitle}
        />
      ) : null}
    </>
  );
}

function ConfidenceCell({ match }: { match: MatchRow }) {
  const [open, setOpen] = useState(false);
  const score = match.confidenceScore;
  const category = match.confidenceCategory ?? categorizeConfidence(score);
  const reasons = match.confidenceReasons ?? [];
  const hasReasons = reasons.length > 0;

  if (typeof score !== "number") {
    return <span className="text-sm text-gray-500">—</span>;
  }

  const pillClasses =
    category === "High"
      ? "bg-green-50 text-green-800 border border-green-200"
      : category === "Medium"
        ? "bg-amber-50 text-amber-800 border border-amber-200"
        : "bg-red-50 text-red-800 border border-red-200";

  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-gray-900" title={hasReasons ? reasons.join(" • ") : undefined}>
          {score}%
        </span>
        {category ? (
          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${pillClasses}`} title={`Confidence: ${category}`}>
            {category}
          </span>
        ) : null}
        {hasReasons ? (
          <button
            type="button"
            className="text-[11px] font-semibold text-blue-700 underline decoration-dotted underline-offset-2 hover:text-blue-900"
            onClick={() => {
              setOpen((current) => {
                const next = !current;

                if (next) {
                  void logRecruiterBehavior({
                    action: "CANDIDATE_OPEN",
                    jobId: match.jobId,
                    matchId: match.id,
                    candidateId: match.candidateId,
                    confidence: category,
                    details: { trigger: "confidence_details" },
                  });
                }

                return next;
              });
            }}
          >
            {open ? "Hide details" : "Show details"}
          </button>
        ) : null}
      </div>
      {open && hasReasons ? (
        <ul className="list-inside list-disc space-y-1 text-xs text-gray-700">
          {reasons.map((reason, index) => (
            <li key={`${match.id}-reason-${index}`}>{reason}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ExplainabilityCell({ match, onExplain }: { match: MatchRow; onExplain: () => void }) {
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  const explanation = normalizeMatchExplanation(match.explanation);

  const handleToggle = () => {
    const now = Date.now();

    if (!open) {
      setOpen(true);
      setOpenedAt(now);

      const confidenceBand = match.confidenceCategory ?? categorizeConfidence(match.confidenceScore);

      void logRecruiterBehavior({
        action: "CANDIDATE_OPEN",
        jobId: match.jobId,
        matchId: match.id,
        candidateId: match.candidateId,
        confidence: confidenceBand,
        details: { trigger: "explainability" },
      });

      void logRecruiterBehavior({
        action: "EXPLANATION_EXPANDED",
        jobId: match.jobId,
        matchId: match.id,
        candidateId: match.candidateId,
        confidence: confidenceBand,
        details: { jobTitle: match.jobTitle },
      });
      return;
    }

    setOpen(false);

    if (openedAt) {
      void logRecruiterBehavior({
        action: "DECISION_TIME",
        jobId: match.jobId,
        matchId: match.id,
        candidateId: match.candidateId,
        confidence: match.confidenceCategory ?? categorizeConfidence(match.confidenceScore),
        durationMs: Math.max(0, now - openedAt),
        details: { source: "explainability" },
      });
    }

    setOpenedAt(null);
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleToggle}
        className="text-xs font-semibold text-blue-700 hover:text-blue-900"
      >
        {open ? "Hide reasoning" : "Show reasoning"}
      </button>

      <div>
        <button
          type="button"
          onClick={onExplain}
          className="text-[11px] font-semibold text-blue-700 underline decoration-dotted underline-offset-2 hover:text-blue-900"
        >
          Run explain agent
        </button>
      </div>

      {open && (
        <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800">
          <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-wide text-gray-600">
            <span className="rounded bg-white px-2 py-1 font-semibold text-gray-900">Score: {match.score ?? "—"}</span>
            <span className="rounded bg-white px-2 py-1 font-semibold text-gray-900">
              Skills: {match.skillScore ?? "—"}
            </span>
            <span className="rounded bg-white px-2 py-1 font-semibold text-gray-900">
              Seniority: {match.seniorityScore ?? "—"}
            </span>
            <span className="rounded bg-white px-2 py-1 font-semibold text-gray-900">
              Location: {match.locationScore ?? "—"}
            </span>
            <span className="rounded bg-white px-2 py-1 font-semibold text-gray-900">
              Engagement: {match.candidateSignalScore ?? "—"}
            </span>
          </div>

          <div className="space-y-1">
            <div className="font-semibold text-gray-900">Top reasons</div>
            {explanation.topReasons.length === 0 ? (
              <p className="text-gray-700">No reasons recorded.</p>
            ) : (
              <ul className="list-inside list-disc space-y-1 text-gray-700">
                {explanation.topReasons.map((reason, index) => (
                  <li key={`${reason}-${index}`}>{reason}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1">
            <div className="font-semibold text-gray-900">Risk areas</div>
            {explanation.riskAreas.length === 0 ? (
              <p className="text-gray-700">No major risks detected.</p>
            ) : (
              <ul className="list-inside list-disc space-y-1 text-gray-700">
                {explanation.riskAreas.map((risk, index) => (
                  <li key={`${risk}-${index}`}>{risk}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1">
            <div className="font-semibold text-gray-900">Missing skills</div>
            {explanation.missingSkills.length === 0 ? (
              <p className="text-gray-700">No missing skills identified.</p>
            ) : (
              <ul className="list-inside list-disc space-y-1 text-gray-700">
                {explanation.missingSkills.map((skill) => (
                  <li key={skill}>{skill}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1">
            <div className="font-semibold text-gray-900">Engagement signals</div>
            {match.candidateSignalBreakdown ? (
              <ul className="list-inside list-disc space-y-1 text-gray-700">
                <li>
                  Recent activity: {match.candidateSignalBreakdown.recentActivity.score} —
                  {" "}
                  {match.candidateSignalBreakdown.recentActivity.reason}
                </li>
                <li>
                  Outreach: {match.candidateSignalBreakdown.outreachInteractions.score} — {match.candidateSignalBreakdown.outreachInteractions.reason}
                </li>
                <li>
                  Status: {match.candidateSignalBreakdown.statusProgression.score} — {match.candidateSignalBreakdown.statusProgression.reason}
                </li>
              </ul>
            ) : (
              <p className="text-gray-700">No engagement signals were recorded for this match.</p>
            )}
          </div>

          <div className="space-y-1">
            <div className="font-semibold text-gray-900">Skill overlap</div>
            {explanation.skillOverlapMap.length === 0 ? (
              <p className="text-gray-700">No skill overlap information available.</p>
            ) : (
              <ul className="space-y-1 text-gray-700">
                {explanation.skillOverlapMap.map((entry) => (
                  <li key={`${entry.skill}-${entry.importance}-${entry.status}-${entry.weight}`} className="flex items-start justify-between rounded border border-gray-200 bg-white px-2 py-1">
                    <div>
                      <span className="font-medium text-gray-900">{entry.skill}</span>{" "}
                      <span className="text-[10px] text-gray-600">({entry.importance})</span>
                      <div className="text-[11px] text-gray-600">{entry.note}</div>
                    </div>
                    <span className={`text-[11px] font-semibold ${entry.status === "matched" ? "text-green-700" : "text-red-700"}`}>
                      {entry.status === "matched" ? "Matched" : "Missing"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1">
            <div className="font-semibold text-gray-900">Human-ready summary</div>
            <textarea
              readOnly
              className="w-full rounded border border-gray-200 bg-white p-2 text-xs text-gray-800"
              rows={3}
              value={explanation.exportableText}
            />
          </div>
        </div>
      )}
    </div>
  );
}

type ExplainAgentPanelProps = {
  isLoading: boolean;
  result: ReturnType<typeof normalizeMatchExplanation> | null;
  match: MatchRow;
  onClose: () => void;
  error: string | null;
  jobTitle: string;
};

function ExplainAgentPanel({ isLoading, result, match, onClose, error, jobTitle }: ExplainAgentPanelProps) {
  const explanation = result ?? normalizeMatchExplanation(match.explanation);
  const skillOverlap = explanation.skillOverlapMap ?? [];

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/30">
      <button aria-label="Close explain panel" className="flex-1" onClick={onClose} />
      <div className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Explain agent</p>
            <h3 className="text-lg font-semibold text-gray-900">{match.candidateName}</h3>
            <p className="text-sm text-gray-600">{match.currentTitle ?? "No title"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-200 px-3 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Match context</p>
            <dl className="grid grid-cols-1 gap-3 text-sm text-gray-800 sm:grid-cols-2">
              <div>
                <dt className="text-gray-600">Job title</dt>
                <dd className="font-semibold text-gray-900">{jobTitle}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Candidate title</dt>
                <dd className="font-semibold text-gray-900">{match.currentTitle ?? "Title not provided"}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Location</dt>
                <dd className="font-semibold text-gray-900">{match.candidateLocation ?? "Location not provided"}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Match score</dt>
                <dd className="font-semibold text-gray-900">{match.score ?? "—"}</dd>
              </div>
            </dl>
            <div className="space-y-1">
              <p className="text-gray-600">Candidate skills (from profile)</p>
              <div className="flex flex-wrap gap-2">
                {(match.keySkills ?? []).length === 0 ? (
                  <span className="text-xs text-gray-700">No skills recorded</span>
                ) : (
                  (match.keySkills ?? []).map((skill) => (
                    <span key={`${match.id}-cand-skill-${skill}`} className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-gray-800">
                      {skill}
                    </span>
                  ))
                )}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-gray-600">Job skills (from intake)</p>
              <div className="flex flex-wrap gap-2">
                {(match.jobSkills ?? []).length === 0 ? (
                  <span className="text-xs text-gray-700">No job skills recorded</span>
                ) : (
                  (match.jobSkills ?? []).map((skill) => (
                    <span key={`${match.id}-job-skill-${skill}`} className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-800">
                      {skill}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Agent-generated insight</p>
              {isLoading ? <span className="text-xs text-blue-700">Calling /api/agents/explain…</span> : null}
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <div className="space-y-2 rounded-md border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-900">Top reasons</p>
              {explanation.topReasons.length === 0 ? (
                <p className="text-sm text-gray-800">{isLoading ? "Generating reasons..." : "No reasons available."}</p>
              ) : (
                <ul className="list-inside list-disc space-y-1 text-sm text-gray-800">
                  {explanation.topReasons.map((reason, idx) => (
                    <li key={`${match.id}-top-reason-${idx}`}>{reason}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 rounded-md border border-green-200 bg-green-50 p-4">
                <p className="text-sm font-semibold text-green-800">Skill overlap</p>
                {skillOverlap.length === 0 ? (
                  <p className="text-sm text-green-800">{isLoading ? "Collecting overlap..." : "No overlap recorded."}</p>
                ) : (
                  <ul className="space-y-1 text-sm text-green-800">
                    {skillOverlap.map((entry) => (
                      <li key={`${match.id}-${entry.skill}-${entry.importance}-${entry.status}`}>{`${entry.skill} (${entry.importance}) - ${entry.status}`}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-800">Risk areas</p>
                {explanation.riskAreas.length === 0 ? (
                  <p className="text-sm text-amber-800">{isLoading ? "Identifying risks..." : "No risks flagged."}</p>
                ) : (
                  <ul className="list-inside list-disc space-y-1 text-sm text-amber-800">
                    {explanation.riskAreas.map((item, idx) => (
                      <li key={`${match.id}-risk-${idx}`}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="space-y-2 rounded-md border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-900">Missing skills</p>
              {explanation.missingSkills.length === 0 ? (
                <p className="text-sm text-gray-800">{isLoading ? "Analyzing skills..." : "No missing skills noted."}</p>
              ) : (
                <ul className="list-inside list-disc space-y-1 text-sm text-gray-800">
                  {explanation.missingSkills.map((skill, idx) => (
                    <li key={`${match.id}-missing-${idx}`}>{skill}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-1">
              <div className="font-semibold text-gray-900">Human-ready summary</div>
              <textarea
                readOnly
                className="w-full rounded border border-gray-200 bg-white p-2 text-xs text-gray-800"
                rows={3}
                value={explanation.exportableText}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
