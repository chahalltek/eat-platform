"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { FilterFn } from "@tanstack/react-table";

import { StandardTable } from "@/components/table/StandardTable";
import { TableFilterDropdown, type TableFilterOption } from "@/components/table/TableFilterDropdown";
import { TableSearchInput } from "@/components/table/TableSearchInput";
import type { ETETableColumn } from "@/components/table/tableTypes";
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
  failed: "error",
  partial: "warning",
};

const globalFilterFn: FilterFn<AgentRunTableRow> = (row, _columnId, filterValue) => {
  const query = typeof filterValue === "string" ? filterValue.trim().toLowerCase() : "";
  if (!query) return true;
  const values = [row.original.agentName, row.original.status ?? "", row.original.candidateId ?? "", row.original.source];
  return values.some((value) => value?.toString().toLowerCase().includes(query));
};

const multiSelectFilter: FilterFn<AgentRunTableRow> = (row, columnId, filterValue) => {
  const selections = Array.isArray(filterValue) ? filterValue : [];
  if (selections.length === 0) return true;
  const value = row.getValue<string | string[] | null>(columnId) ?? "Status not reported";
  if (Array.isArray(value)) return value.some((entry) => selections.includes(String(entry)));
  return selections.includes(String(value));
};

export function AgentRunsTable({ runs }: { runs: AgentRunTableRow[] }) {
  const agentOptions = useMemo<TableFilterOption[]>(() => {
    const agentNames = Array.from(new Set(runs.map((run) => run.agentName))).sort();
    return agentNames.map((name) => ({ value: name, label: name }));
  }, [runs]);

  const statusOptions = useMemo<TableFilterOption[]>(() => {
    const statuses = Array.from(new Set(runs.map((run) => run.status ?? "Status not reported"))).sort();
    return statuses.map((status) => ({ value: status, label: status }));
  }, [runs]);

  const columns = useMemo<ETETableColumn<AgentRunTableRow>[]>(
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
      {
        ...createTextColumn<AgentRunTableRow, "agentName">({
          accessorKey: "agentName",
          header: "Agent Name",
        }),
        filterFn: multiSelectFilter,
      },
      {
        ...createStatusBadgeColumn<AgentRunTableRow, "status">({
          accessorKey: "status",
          header: "Status",
          sortable: true,
          formatLabel: (value) => (value ? value.toString() : "Status not reported"),
          getVariant: (value) => STATUS_VARIANTS[value?.toLowerCase?.() ?? ""] ?? "neutral",
        }),
        enableSorting: true,
        filterFn: multiSelectFilter,
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
      filtering={{
        columnFilters: { initialState: [] },
        globalFilter: { initialState: "" },
        globalFilterFn,
      }}
      renderToolbar={(table) => (
        <div className="flex flex-wrap items-center gap-3">
          <TableSearchInput
            table={table}
            placeholder="Search by agent, status, or candidate"
            label="Search"
            className="w-full md:w-80"
          />
          <TableFilterDropdown table={table} columnId="agentName" label="Agent" options={agentOptions} />
          <TableFilterDropdown table={table} columnId="status" label="Status" options={statusOptions} />
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {table.getRowModel().rows.length} results
          </p>
        </div>
      )}
      emptyState={<p className="py-6 text-center text-sm text-slate-600">No runs available.</p>}
    />
  );
}
