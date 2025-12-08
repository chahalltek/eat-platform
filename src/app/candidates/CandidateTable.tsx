"use client";

import { useMemo } from "react";
import Link from "next/link";

import type { FilterFn } from "@tanstack/react-table";
import { EATTable, flexRender } from "@/components/table/EATTable";
import { TableSearchInput } from "@/components/table/TableSearchInput";
import { TableToolbar } from "@/components/table/TableToolbar";
import { getTableCellClasses, getTableClassNames, getTableRowClasses } from "@/components/table/tableStyles";
import { EATTableColumn, createNumberColumn, createTextColumn } from "@/components/table/tableTypes";

export type CandidateRow = {
  id: string;
  fullName: string;
  currentTitle: string | null;
  location: string | null;
  parsingConfidence: number | null;
  updatedAt: string;
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
      createTextColumn({
        accessorKey: "location",
        header: "Location",
        sortable: false,
        cell: ({ getValue }) => getValue<string | null>() ?? "—",
      }),
      {
        ...createNumberColumn({
          accessorKey: "parsingConfidence",
          header: "Confidence",
        }),
        cell: ({ getValue }) => {
          const value = getValue<number | null>();
          if (typeof value !== "number") return "—";
          return `${Math.round(value * 100)}%`;
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

  return { columns, globalFilterFn };
}

export function CandidateTable({ candidates }: { candidates: CandidateRow[] }) {
  const { columns, globalFilterFn } = useCandidateTable(candidates);

  return (
    <div className="mt-6 space-y-4">
      <EATTable
        data={candidates}
        columns={columns}
        sorting={{ initialState: [{ id: "updatedAt", desc: true }] }}
        filtering={{ globalFilter: { initialState: "" }, globalFilterFn }}
        variant="comfortable"
      >
        {({ headerGroups, rows, styles, table }) => {
          const classNames = getTableClassNames(styles);

          return (
            <div className="space-y-4">
              <TableToolbar>
                <TableSearchInput
                  table={table}
                  label="Search candidates"
                  placeholder="Search by name, role, or location"
                />
              </TableToolbar>

              <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm">
                <table className={classNames.table}>
                  <thead className={classNames.header}>
                    {headerGroups.map((headerGroup) => (
                      <tr key={headerGroup.id} className={classNames.headerRow}>
                        {headerGroup.headers
                          .filter((header) => !header.isPlaceholder)
                          .map((header) => (
                            <th key={header.id} className={classNames.headerCell} scope="col">
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 text-left"
                                onClick={() => header.column.toggleSorting(undefined, false)}
                                disabled={!header.column.getCanSort()}
                              >
                                <span className="select-none">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                                {header.column.getCanSort() ? (
                                  <span aria-live="polite" className="text-xs text-slate-500">
                                    {header.column.getIsSorted() === "asc"
                                      ? "▲"
                                      : header.column.getIsSorted() === "desc"
                                        ? "▼"
                                        : "⇅"}
                                  </span>
                                ) : null}
                              </button>
                            </th>
                          ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody className={classNames.body}>
                    {rows.length === 0 ? (
                      <tr className={getTableRowClasses(styles)}>
                        <td className={getTableCellClasses(styles)} colSpan={columns.length}>
                          <div className="py-6 text-center text-sm text-slate-500">No candidates found.</div>
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => (
                        <tr
                          key={row.id}
                          className={getTableRowClasses(styles, { hover: true, striped: true })}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className={getTableCellClasses(styles)}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
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
