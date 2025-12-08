"use client";

import { useMemo } from "react";
import clsx from "clsx";
import { flexRender, type FilterFn } from "@tanstack/react-table";

import { EATTable } from "@/components/table/EATTable";
import { TableFilterDropdown, type TableFilterOption } from "@/components/table/TableFilterDropdown";
import { TableSearchInput } from "@/components/table/TableSearchInput";
import { TableToolbar } from "@/components/table/TableToolbar";
import {
  EATTableColumn,
  createNumberColumn,
  createStatusBadgeColumn,
  createTextColumn,
} from "@/components/table/tableTypes";
import { getTableCellClasses, getTableClassNames, getTableRowClasses } from "@/components/table/tableStyles";
import type { AgentRunStatusValue, SerializableLog } from "./types";

export type AgentRunLogTableRow = SerializableLog;

const STATUS_LABELS: Record<AgentRunStatusValue, string> = {
  RUNNING: "Running",
  SUCCESS: "Success",
  FAILED: "Failed",
  PARTIAL: "Partial",
};

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

  const haystack = [row.original.agentName, row.original.userLabel, STATUS_LABELS[row.original.status]]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
};

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
          cell: ({ getValue }) => <span className="font-semibold text-slate-900">{getValue()}</span>,
        }),
        filterFn: multiSelectFilter,
      },
      createTextColumn<AgentRunLogTableRow, "userLabel">({
        accessorKey: "userLabel",
        header: "User/Recruiter",
        sortable: true,
      }),
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
      <EATTable
        data={logs}
        columns={columns}
        sorting={{ initialState: [{ id: "startedAt", desc: true }] }}
        filtering={{
          columnFilters: { initialState: [] },
          globalFilter: { initialState: "" },
          globalFilterFn,
        }}
        variant="compact"
      >
        {({ headerGroups, rows, styles, table }) => {
          const classNames = getTableClassNames(styles);
          return (
            <div className="space-y-3">
              <TableToolbar>
                <TableSearchInput table={table} placeholder="Search runs" label="Search" className="w-full md:w-72" />
                <TableFilterDropdown table={table} columnId="agentName" label="Agent" options={agentOptions} />
                <TableFilterDropdown table={table} columnId="status" label="Status" options={STATUS_FILTER_OPTIONS} />
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{rows.length} results</p>
              </TableToolbar>

              <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                <table className={classNames.table}>
                  <thead className={classNames.header}>
                    {headerGroups.map((headerGroup) => (
                      <tr key={headerGroup.id} className={classNames.headerRow}>
                        {headerGroup.headers.map((header) => {
                          const sortedState = header.column.getIsSorted();
                          return (
                            <th key={header.id} colSpan={header.colSpan} className={classNames.headerCell}>
                              {header.isPlaceholder ? null : (
                                <button
                                  type="button"
                                  onClick={header.column.getToggleSortingHandler()}
                                  className={clsx("flex items-center gap-2", {
                                    "text-indigo-700": sortedState,
                                    "cursor-default": !header.column.getCanSort(),
                                  })}
                                  aria-label={
                                    sortedState === "asc"
                                      ? `${String(header.column.columnDef.header)} sorted ascending`
                                      : sortedState === "desc"
                                        ? `${String(header.column.columnDef.header)} sorted descending`
                                        : `${String(header.column.columnDef.header)} sortable`
                                  }
                                >
                                  <span>{String(header.column.columnDef.header)}</span>
                                  {sortedState === "asc" && <span aria-hidden="true">↑</span>}
                                  {sortedState === "desc" && <span aria-hidden="true">↓</span>}
                                </button>
                              )}
                            </th>
                          );
                        })}
                      </tr>
                    ))}
                  </thead>
                  <tbody className={classNames.body}>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className={getTableRowClasses(styles, {
                          hover: true,
                          striped: true,
                          selected: row.original.id === selectedId,
                        })}
                        data-state={row.original.id === selectedId ? "selected" : undefined}
                        onClick={() => onSelect(row.original.id)}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className={getTableCellClasses(styles)}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {rows.length === 0 ? (
                      <tr className={getTableRowClasses(styles)}>
                        <td className={getTableCellClasses(styles)} colSpan={columns.length}>
                          <p className="py-4 text-center text-sm text-slate-600">No runs match the selected filters.</p>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          );
        }}
      </EATTable>
    </div>
  );
}

