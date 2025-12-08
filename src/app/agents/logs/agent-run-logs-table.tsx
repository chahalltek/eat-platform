"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { flexRender } from "@tanstack/react-table";

import { EATTable } from "@/components/table/EATTable";
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

export function filterLogsBySelections(
  logs: AgentRunLogTableRow[],
  agentNames: string[],
  statuses: AgentRunStatusValue[],
): AgentRunLogTableRow[] {
  return logs.filter((log) => {
    const matchesAgent = agentNames.length === 0 || agentNames.includes(log.agentName);
    const matchesStatus = statuses.length === 0 || statuses.includes(log.status);
    return matchesAgent && matchesStatus;
  });
}

type MultiSelectOption = { value: string; label: string };

function MultiSelectFilter({
  label,
  options,
  values,
  onChange,
  testId,
}: {
  label: string;
  options: MultiSelectOption[];
  values: string[];
  onChange: (next: string[]) => void;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);

  const toggleValue = (value: string) => {
    const exists = values.includes(value);
    onChange(exists ? values.filter((item) => item !== value) : [...values, value]);
  };

  const summary = values.length ? `${values.length} selected` : "All";

  return (
    <div className="relative" data-testid={testId}>
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-300"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="text-slate-600">{label}:</span>
        <span>{summary}</span>
      </button>

      {open ? (
        <div className="absolute z-10 mt-2 min-w-[220px] rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          <div className="flex items-center justify-between pb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <button
              type="button"
              className="text-xs font-semibold text-indigo-600 underline"
              onClick={() => onChange([])}
            >
              Clear
            </button>
          </div>
          <div className="flex max-h-48 flex-col gap-2 overflow-y-auto">
            {options.map((option) => (
              <label key={option.value} className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={values.includes(option.value)}
                  onChange={() => toggleValue(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
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
  const [agentFilter, setAgentFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<AgentRunStatusValue[]>([]);

  const agentOptions = useMemo<MultiSelectOption[]>(() => {
    const agentNames = Array.from(new Set(logs.map((log) => log.agentName))).sort();
    return agentNames.map((name) => ({ value: name, label: name }));
  }, [logs]);

  const filteredLogs = useMemo(
    () => filterLogsBySelections(logs, agentFilter, statusFilter),
    [agentFilter, logs, statusFilter],
  );

  const columns = useMemo<EATTableColumn<AgentRunLogTableRow>[]>(
    () => [
      createTextColumn<AgentRunLogTableRow, "startedAt">({
        accessorKey: "startedAt",
        header: "Timestamp",
        sortable: true,
        cell: ({ getValue }) => <span className="whitespace-nowrap">{formatTimestamp(getValue())}</span>,
      }),
      createTextColumn<AgentRunLogTableRow, "agentName">({
        accessorKey: "agentName",
        header: "Agent",
        sortable: true,
        cell: ({ getValue }) => <span className="font-semibold text-slate-900">{getValue()}</span>,
      }),
      createTextColumn<AgentRunLogTableRow, "userLabel">({
        accessorKey: "userLabel",
        header: "User/Recruiter",
        sortable: true,
      }),
      createStatusBadgeColumn<AgentRunLogTableRow, "status">({
        accessorKey: "status",
        header: "Status",
        sortable: true,
        formatLabel: (value) => STATUS_LABELS[value],
        getVariant: (value) => STATUS_VARIANTS[value],
      }),
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
      <div className="flex flex-wrap items-center gap-3">
        <MultiSelectFilter
          label="Agent"
          options={agentOptions}
          values={agentFilter}
          onChange={setAgentFilter}
          testId="agent-filter"
        />
        <MultiSelectFilter
          label="Status"
          options={STATUS_FILTER_OPTIONS}
          values={statusFilter}
          onChange={(values) => setStatusFilter(values as AgentRunStatusValue[])}
          testId="status-filter"
        />
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{filteredLogs.length} results</p>
      </div>

      <EATTable
        data={filteredLogs}
        columns={columns}
        sorting={{ initialState: [{ id: "startedAt", desc: true }] }}
        variant="compact"
      >
        {({ headerGroups, rows, styles }) => {
          const classNames = getTableClassNames(styles);
          return (
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
          );
        }}
      </EATTable>
    </div>
  );
}
