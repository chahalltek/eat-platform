"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { FilterFn } from "@tanstack/react-table";

import { StandardTable } from "@/components/table/StandardTable";
import { TableSearchInput } from "@/components/table/TableSearchInput";
import type { ETETableColumn } from "@/components/table/tableTypes";
import { createNumberColumn, createStatusBadgeColumn, createTextColumn } from "@/components/table/tableTypes";

export type JobOpportunityRow = {
  id: string;
  jobReqId: string;
  title: string;
  location?: string | null;
  customerName?: string | null;
  status: string;
  matchScore?: number | null;
};

const STATUS_VARIANTS: Record<string, "success" | "info" | "warning" | "error" | "neutral"> = {
  shortlisted: "info",
  submitted: "info",
  interviewing: "warning",
  hired: "success",
  rejected: "error",
};

const globalFilterFn: FilterFn<JobOpportunityRow> = (row, _columnId, filterValue) => {
  const query = typeof filterValue === "string" ? filterValue.trim().toLowerCase() : "";
  if (!query) return true;
  const values = [row.original.title, row.original.customerName ?? "", row.original.location ?? "", row.original.status];
  return values.some((value) => value?.toString().toLowerCase().includes(query));
};

export function JobOpportunitiesTable({ jobs }: { jobs: JobOpportunityRow[] }) {
  const columns = useMemo<ETETableColumn<JobOpportunityRow>[]>(
    () => [
      {
        ...createTextColumn<JobOpportunityRow, "title">({
          accessorKey: "title",
          header: "Job",
        }),
        cell: ({ row }) => (
          <div className="space-y-1">
            <Link href={`/jobs/${row.original.jobReqId}`} className="font-semibold text-indigo-700 hover:text-indigo-900">
              {row.original.title}
            </Link>
            <p className="text-xs text-slate-600">{row.original.location ?? "—"}</p>
          </div>
        ),
      },
      createTextColumn<JobOpportunityRow, "customerName">({
        accessorKey: "customerName",
        header: "Customer",
        cell: ({ getValue }) => getValue<string | null>() ?? "—",
      }),
      {
        ...createStatusBadgeColumn<JobOpportunityRow, "status">({
          accessorKey: "status",
          header: "Status",
          sortable: false,
          formatLabel: (value) => value.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()),
          getVariant: (value) => STATUS_VARIANTS[value.toLowerCase()] ?? "neutral",
        }),
        enableSorting: false,
      },
      {
        ...createNumberColumn<JobOpportunityRow, "matchScore">({
          accessorKey: "matchScore",
          header: "Match score",
        }),
        cell: ({ getValue }) => {
          const value = getValue<number | null>();
          return typeof value === "number" ? `${Math.round(value * 100)}%` : "—";
        },
        sortingFn: (rowA, rowB) => (rowA.original.matchScore ?? 0) - (rowB.original.matchScore ?? 0),
      },
      {
        id: "links",
        header: "Links",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-col space-y-1 text-sm text-blue-600">
            <Link href={`/jobs/${row.original.jobReqId}`} className="hover:text-blue-800">
              Job details
            </Link>
            <Link href={`/jobs/${row.original.jobReqId}/matches`} className="hover:text-blue-800">
              Matches
            </Link>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <StandardTable
      data={jobs}
      columns={columns}
      sorting={{ initialState: [{ id: "matchScore", desc: true }] }}
      filtering={{ globalFilter: { initialState: "" }, globalFilterFn }}
      renderToolbar={(table) => (
        <TableSearchInput table={table} placeholder="Search job opportunities" label="Search" />
      )}
      emptyState={<p className="py-6 text-center text-sm text-slate-600">This candidate has not been linked to any jobs yet.</p>}
    />
  );
}
