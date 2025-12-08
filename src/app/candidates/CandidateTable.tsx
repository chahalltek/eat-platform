"use client";

import { useMemo } from "react";
import Link from "next/link";

import type { FilterFn } from "@tanstack/react-table";

import { StandardTable } from "@/components/table/StandardTable";
import { TableFilterDropdown } from "@/components/table/TableFilterDropdown";
import { TableSearchInput } from "@/components/table/TableSearchInput";
import { TableToolbar } from "@/components/table/TableToolbar";
import { EATTableColumn, createNumberColumn, createStatusBadgeColumn, createTextColumn } from "@/components/table/tableTypes";

export type CandidateRow = {
  id: string;
  fullName: string;
  currentTitle: string | null;
  location: string | null;
<<<<<<< ours
  status: string | null;
  parsingConfidence: number | null;
=======
  confidenceScore: number;
>>>>>>> theirs
  updatedAt: string;
};

const multiSelectFilter: FilterFn<CandidateRow> = (row, columnId, filterValue) => {
  const selections = Array.isArray(filterValue) ? (filterValue as string[]) : [];
  if (!selections.length) return true;

  const value = row.getValue<string | null>(columnId);
  if (!value) return false;

  return selections.includes(value);
};

function normalizeConfidence(value: number | null) {
  return typeof value === "number" ? value : -Infinity;
}

export function useCandidateTable(candidates: CandidateRow[]) {
  const columns = useMemo<EATTableColumn<CandidateRow>[]>(
    () => [
      createTextColumn({
        accessorKey: "fullName",
        header: "Candidate",
        cell: ({ getValue, row }) => (
          <div className="flex flex-col">
            <Link
              href={`/candidates/${row.original.id}`}
              className="font-semibold text-indigo-700 hover:text-indigo-900"
            >
              {getValue<string>()}
            </Link>
            {row.original.currentTitle ? (
              <span className="text-xs text-slate-500">{row.original.currentTitle}</span>
            ) : null}
          </div>
        ),
      }),
      createTextColumn({
        accessorKey: "currentTitle",
        header: "Primary role",
        sortable: false,
        cell: ({ getValue }) => getValue<string | null>() ?? "—",
      }),
      {
        ...createTextColumn({
          accessorKey: "location",
          header: "Location",
          sortable: false,
          cell: ({ getValue }) => getValue<string | null>() ?? "—",
        }),
        filterFn: multiSelectFilter,
      },
      {
        ...createStatusBadgeColumn({
          accessorKey: "status",
          header: "Status",
          sortable: false,
          formatLabel: (value) => (value ? String(value) : "Unknown"),
          getVariant: (value) => (value ? "info" : "neutral"),
        }),
        enableSorting: false,
        filterFn: multiSelectFilter,
      },
      {
        ...createNumberColumn({
<<<<<<< ours
          accessorKey: "parsingConfidence",
          header: "Score",
=======
          accessorKey: "confidenceScore",
          header: "Confidence",
>>>>>>> theirs
        }),
        cell: ({ getValue }) => {
          const value = getValue<number | null>();
          if (typeof value !== "number") return "—";
          return `${value}%`;
        },
        sortingFn: (rowA, rowB, columnId) => {
          const first = rowA.getValue<number | null>(columnId);
          const second = rowB.getValue<number | null>(columnId);

          return normalizeConfidence(first) - normalizeConfidence(second);
        },
      },
      createTextColumn({
        accessorKey: "updatedAt",
        header: "Last updated",
        cell: ({ getValue }) => new Date(getValue<string>()).toLocaleString(),
      }),
    ],
    [],
  );

  const globalFilterFn = useMemo<FilterFn<CandidateRow>>(
    () =>
      (row, _columnId, filterValue) => {
        const query = typeof filterValue === "string" ? filterValue.trim().toLowerCase() : "";
        if (!query) return true;

        const { fullName, currentTitle, location } = row.original;
        return [fullName, currentTitle, location]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      },
    [],
  );

  const statusOptions = useMemo(() => {
    const uniqueStatuses = new Set<string>();
    candidates.forEach((candidate) => {
      if (candidate.status) uniqueStatuses.add(candidate.status);
    });

    return Array.from(uniqueStatuses)
      .sort((a, b) => a.localeCompare(b))
      .map((status) => ({ label: status, value: status }));
  }, [candidates]);

  const locationOptions = useMemo(() => {
    const uniqueLocations = new Set<string>();
    candidates.forEach((candidate) => {
      if (candidate.location) uniqueLocations.add(candidate.location);
    });

    return Array.from(uniqueLocations)
      .sort((a, b) => a.localeCompare(b))
      .map((location) => ({ label: location, value: location }));
  }, [candidates]);

  return { columns, globalFilterFn, statusOptions, locationOptions };
}

export function CandidateTable({ candidates }: { candidates: CandidateRow[] }) {
  const { columns, globalFilterFn, statusOptions, locationOptions } = useCandidateTable(candidates);

  return (
    <div className="mt-6 space-y-4">
      <StandardTable
        data={candidates}
        columns={columns}
        sorting={{ initialState: [{ id: "updatedAt", desc: true }] }}
        filtering={{
          globalFilter: { initialState: "" },
          columnFilters: { initialState: [] },
          filterFns: { status: multiSelectFilter, location: multiSelectFilter },
          globalFilterFn,
        }}
        renderToolbar={(table) => (
          <TableToolbar>
            <TableSearchInput
              table={table}
              label="Search candidates"
              placeholder="Search by name, role, or location"
            />
            {statusOptions.length ? (
              <TableFilterDropdown table={table} columnId="status" label="Status" options={statusOptions} />
            ) : null}
            {locationOptions.length ? (
              <TableFilterDropdown table={table} columnId="location" label="Location" options={locationOptions} />
            ) : null}
          </TableToolbar>
        )}
        emptyState={<div className="py-6 text-center text-sm text-slate-500">No candidates found.</div>}
      />
    </div>
  );
}
