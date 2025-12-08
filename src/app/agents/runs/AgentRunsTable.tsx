"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { FilterFn } from "@tanstack/react-table";

import { StandardTable } from "@/components/table/StandardTable";
import { TableSearchInput } from "@/components/table/TableSearchInput";
import type { EATTableColumn } from "@/components/table/tableTypes";
import { createStatusBadgeColumn, createTextColumn } from "@/components/table/tableTypes";

export type AgentRunTableRow = {
  id: string;
  agentName: string;
  status: string | null;
  startedAt: string;
  candidateId?: string;
  source: string;
};

const STATUS_VARIANTS: Record<string, "success" | "error" | "info" | "warning" | "neutral"> = {
  running: "info",
  success: "success",
  error: "error",
  failure: "error",
};

const globalFilterFn: FilterFn<AgentRunTableRow> = (row, _columnId, filterValue) => {
  const query = typeof filterValue === "string" ? filterValue.trim().toLowerCase() : "";
  if (!query) return true;
  const values = [row.original.agentName, row.original.status ?? "", row.original.candidateId ?? "", row.original.source];
  return values.some((value) => value?.toString().toLowerCase().includes(query));
};

export function AgentRunsTable({ runs }: { runs: AgentRunTableRow[] }) {
  const columns = useMemo<EATTableColumn<AgentRunTableRow>[]>(
    () => [
      {
        ...createTextColumn<AgentRunTableRow, "startedAt">({
          accessorKey: "startedAt",
          header: "Created At",
        }),
        sortingFn: (rowA, rowB) =>
          new Date(rowA.original.startedAt).getTime() - new Date(rowB.original.startedAt).getTime(),
        cell: ({ getValue }) => new Date(getValue<string>()).toLocaleString(),
      },
      createTextColumn<AgentRunTableRow, "agentName">({
        accessorKey: "agentName",
        header: "Agent Name",
      }),
      {
        ...createStatusBadgeColumn<AgentRunTableRow, "status">({
          accessorKey: "status",
          header: "Status",
          sortable: true,
          formatLabel: (value) => (value ? value.toString() : "Unknown"),
          getVariant: (value) => STATUS_VARIANTS[value?.toLowerCase?.() ?? ""] ?? "neutral",
        }),
        enableSorting: true,
      },
      createTextColumn<AgentRunTableRow, "candidateId">({
        accessorKey: "candidateId",
        header: "Candidate ID",
        sortable: false,
        cell: ({ getValue }) => getValue<string | undefined>() ?? "—",
      }),
      createTextColumn<AgentRunTableRow, "source">({
        accessorKey: "source",
        header: "Source",
        sortable: false,
        cell: ({ getValue }) => getValue<string>() || "—",
      }),
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <Link href={`/agents/runs/${row.original.id}`} className="text-blue-600 hover:text-blue-800">
            View
          </Link>
        ),
      },
    ],
    [],
  );

  return (
    <StandardTable
      data={runs}
      columns={columns}
      sorting={{ initialState: [{ id: "startedAt", desc: true }] }}
      filtering={{ globalFilter: { initialState: "" }, globalFilterFn }}
      renderToolbar={(table) => (
        <TableSearchInput table={table} placeholder="Search by agent, status, or candidate" label="Search" />
      )}
      emptyState={<p className="py-6 text-center text-sm text-slate-600">No runs available.</p>}
    />
  );
}
