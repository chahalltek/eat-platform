"use client";

import { useMemo, useState } from "react";
import type { FilterFn } from "@tanstack/react-table";

import { StandardTable } from "@/components/table/StandardTable";
import { TableSearchInput } from "@/components/table/TableSearchInput";
import type { EATTableColumn } from "@/components/table/tableTypes";
import { createNumberColumn, createTextColumn } from "@/components/table/tableTypes";
import { JobCandidateStatus } from "@prisma/client";

import { JobCandidateStatusControl } from "./JobCandidateStatusControl";
import { OutreachGenerator } from "./OutreachGenerator";
import type { CandidateSignalBreakdown } from "@/lib/matching/candidateSignals";
import { normalizeMatchExplanation } from "@/lib/matching/explanation";

export type MatchRow = {
  id: string;
  candidateId: string;
  jobId: string;
  candidateName: string;
  currentTitle?: string | null;
  score?: number | null;
  jobCandidateId?: string;
  jobCandidateStatus?: JobCandidateStatus;
  explanation?: unknown;
  skillScore?: number | null;
  seniorityScore?: number | null;
  locationScore?: number | null;
  candidateSignalScore?: number | null;
  candidateSignalBreakdown?: CandidateSignalBreakdown | null;
};

const globalFilterFn: FilterFn<MatchRow> = (row, _columnId, filterValue) => {
  const query = typeof filterValue === "string" ? filterValue.trim().toLowerCase() : "";
  if (!query) return true;
  const values = [row.original.candidateName, row.original.currentTitle ?? ""];
  return values.some((value) => value.toString().toLowerCase().includes(query));
};

export function JobMatchesTable({ matches }: { matches: MatchRow[] }) {
  const columns = useMemo<EATTableColumn<MatchRow>[]>(
    () => [
      {
        ...createTextColumn<MatchRow, "candidateName">({
          accessorKey: "candidateName",
          header: "Candidate",
        }),
        cell: ({ row }) => (
          <div className="space-y-1">
            <div className="font-semibold text-gray-900">{row.original.candidateName ?? "Unknown"}</div>
            <div className="text-xs text-gray-600">{row.original.currentTitle ?? "—"}</div>
          </div>
        ),
      },
      {
        ...createNumberColumn<MatchRow, "score">({
          accessorKey: "score",
          header: "Match Score",
        }),
        cell: ({ getValue }) => {
          const value = getValue<number | null>();
          if (typeof value !== "number") return "—";

          const normalized = value <= 1 ? value * 100 : value;
          return `${Math.round(normalized)}%`;
        },
        sortingFn: (rowA, rowB) => (rowA.original.score ?? 0) - (rowB.original.score ?? 0),
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
        cell: ({ row }) => <ExplainabilityCell match={row.original} />,
      },
    ],
    [],
  );

  return (
    <StandardTable
      data={matches}
      columns={columns}
      sorting={{ initialState: [{ id: "score", desc: true }] }}
      filtering={{ globalFilter: { initialState: "" }, globalFilterFn }}
      renderToolbar={(table) => (
        <TableSearchInput table={table} placeholder="Search candidates" label="Search" />
      )}
      emptyState={<p className="px-6 py-8 text-center text-sm text-gray-700">No matches found for this job yet.</p>}
    />
  );
}

function ExplainabilityCell({ match }: { match: MatchRow }) {
  const [open, setOpen] = useState(false);
  const explanation = normalizeMatchExplanation(match.explanation);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="text-xs font-semibold text-blue-700 hover:text-blue-900"
      >
        {open ? "Hide reasoning" : "Show reasoning"}
      </button>

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
