"use client";

import { useMemo } from "react";
import type { FilterFn } from "@tanstack/react-table";

import { StandardTable } from "@/components/table/StandardTable";
import { TableSearchInput } from "@/components/table/TableSearchInput";
import type { EATTableColumn } from "@/components/table/tableTypes";
import { createNumberColumn, createTextColumn } from "@/components/table/tableTypes";
import { JobCandidateStatus } from "@prisma/client";

import { JobCandidateStatusControl } from "./JobCandidateStatusControl";
import { OutreachGenerator } from "./OutreachGenerator";

export type MatchRow = {
  id: string;
  candidateId: string;
  jobId: string;
  candidateName: string;
  currentTitle?: string | null;
  score?: number | null;
  jobCandidateId?: string;
  jobCandidateStatus?: JobCandidateStatus;
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
          return typeof value === "number" ? `${Math.round(value * 100)}%` : "—";
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
