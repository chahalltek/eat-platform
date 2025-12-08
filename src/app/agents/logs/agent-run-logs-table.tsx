"use client";

import { useMemo } from "react";
import type { FilterFn } from "@tanstack/react-table";

import { StandardTable } from "@/components/table/StandardTable";
import { TableFilterDropdown, type TableFilterOption } from "@/components/table/TableFilterDropdown";
import { TableSearchInput } from "@/components/table/TableSearchInput";
import {
  EATTableColumn,
  createNumberColumn,
  createStatusBadgeColumn,
  createTextColumn,
} from "@/components/table/tableTypes";
import type { AgentRunStatusValue, SerializableLog } from "./types";

export type AgentRunLogTableRow = SerializableLog;

const STATUS_LABELS: Record<AgentRunStatusValue, string> = {
  RUNNING: "Running",
  SUCCESS: "Success",
  FAILED: "Failed",
  PARTIAL: "Partial",
};

const ERROR_CATEGORY_LABELS = {
  AI: "AI failure",
  DATA: "Data failure",
  AUTH: "Auth failure",
} as const;

const ERROR_CATEGORY_VARIANTS = {
  AI: "info",
  DATA: "warning",
  AUTH: "error",
} as const;

const STATUS_VARIANTS: Record<AgentRunStatusValue, "success" | "error" | "info" | "warning"> = {
  RUNNING: "info",
  SUCCESS: "success",
  FAILED: "error",
  PARTIAL: "warning",
};

export const STATUS_FILTER_OPTIONS = (Object.keys(STATUS_LABELS) as AgentRunStatusValue[]).map((value) => ({
  value,
  label: STATUS_LABELS[value],
}));

const ERROR_CATEGORY_FILTER_OPTIONS = (
  Object.keys(ERROR_CATEGORY_LABELS) as (keyof typeof ERROR_CATEGORY_LABELS)[],
).map((value) => ({
  value,
  label: ERROR_CATEGORY_LABELS[value],
}));

export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

export function formatDurationMs(durationMs?: number | null): string {
  if (durationMs === null || durationMs === undefined) return "—";
  if (durationMs < 1000) return `${durationMs} ms`;
  const seconds = durationMs / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
}

const multiSelectFilter: FilterFn<AgentRunLogTableRow> = (row, columnId, filterValue) => {
  const selections = Array.isArray(filterValue) ? filterValue : [];
  if (selections.length === 0) return true;
  const value = row.getValue<string | string[]>(columnId);
  if (Array.isArray(value)) return value.some((entry) => selections.includes(String(entry)));
  return selections.includes(String(value));
};

const globalFilterFn: FilterFn<AgentRunLogTableRow> = (row, _columnId, filterValue) => {
  const query = typeof filterValue === "string" ? filterValue.trim().toLowerCase() : "";
  if (!query) return true;

  const haystack = [
    row.original.agentName,
    row.original.userLabel,
    STATUS_LABELS[row.original.status],
    row.original.errorCategory ? ERROR_CATEGORY_LABELS[row.original.errorCategory] : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
};

function ErrorCategoryBadge({ category }: { category: SerializableLog["errorCategory"] }) {
  if (!category) return <span className="text-slate-400">—</span>;

  const label = ERROR_CATEGORY_LABELS[category];
  const variant = ERROR_CATEGORY_VARIANTS[category];

  const styles: Record<typeof variant, string> = {
    info: "bg-blue-100 text-blue-800",
    warning: "bg-amber-100 text-amber-800",
    error: "bg-red-100 text-red-800",
  };

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[variant]}`}>{label}</span>;
}

export function AgentRunLogsTable({
  logs,
  selectedId,
  onSelect,
}: {
  logs: AgentRunLogTableRow[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const agentOptions = useMemo<TableFilterOption[]>(() => {
    const agentNames = Array.from(new Set(logs.map((log) => log.agentName))).sort();
    return agentNames.map((name) => ({ value: name, label: name }));
  }, [logs]);

  const columns = useMemo<EATTableColumn<AgentRunLogTableRow>[]>(
    () => [
      createTextColumn<AgentRunLogTableRow, "startedAt">({
        accessorKey: "startedAt",
        header: "Timestamp",
        sortable: true,
        cell: ({ getValue }) => <span className="whitespace-nowrap">{formatTimestamp(getValue())}</span>,
      }),
      {
        ...createTextColumn<AgentRunLogTableRow, "agentName">({
          accessorKey: "agentName",
          header: "Agent",
          sortable: true,
        }),
        filterFn: multiSelectFilter,
      },
      createTextColumn<AgentRunLogTableRow, "userLabel">({
        accessorKey: "userLabel",
        header: "User/Recruiter",
        sortable: true,
        cell: ({ getValue }) => getValue<string | null>() ?? "—",
      }),
      {
        accessorKey: "errorCategory",
        header: "Error type",
        filterFn: multiSelectFilter,
        cell: ({ row }) => <ErrorCategoryBadge category={row.original.errorCategory} />, // eslint-disable-line react/jsx-no-bind
      },
      {
        ...createStatusBadgeColumn<AgentRunLogTableRow, "status">({
          accessorKey: "status",
          header: "Status",
          sortable: true,
          formatLabel: (value) => STATUS_LABELS[value],
          getVariant: (value) => STATUS_VARIANTS[value],
        }),
        filterFn: multiSelectFilter,
      },
      createNumberColumn<AgentRunLogTableRow, "durationMs">({
        accessorKey: "durationMs",
        header: "Duration",
        sortable: true,
        formatValue: (value) => <span className="whitespace-nowrap">{formatDurationMs(value)}</span>,
      }),
    ],
    [],
  );

  return (
    <div className="space-y-3">
      <StandardTable
        data={logs}
        columns={columns}
        sorting={{ initialState: [{ id: "startedAt", desc: true }] }}
        filtering={{
          columnFilters: { initialState: [] },
          globalFilter: { initialState: "" },
          globalFilterFn,
        }}
        variant="compact"
        renderToolbar={(table) => (
          <>
            <TableSearchInput table={table} placeholder="Search runs" label="Search" className="w-full md:w-72" />
            <TableFilterDropdown table={table} columnId="agentName" label="Agent" options={agentOptions} />
            <TableFilterDropdown table={table} columnId="errorCategory" label="Error type" options={ERROR_CATEGORY_FILTER_OPTIONS} />
            <TableFilterDropdown table={table} columnId="status" label="Status" options={STATUS_FILTER_OPTIONS} />
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {table.getRowModel().rows.length} results
            </p>
          </>
        )}
        emptyState={<p className="py-4 text-center text-sm text-slate-600">No runs match the selected filters.</p>}
        getRowOptions={(row) => ({
          onClick: () => onSelect(row.original.id),
          selected: row.original.id === selectedId,
        })}
      />
    </div>
  );
}
