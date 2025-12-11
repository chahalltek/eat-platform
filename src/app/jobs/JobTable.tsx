"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { FilterFn } from "@tanstack/react-table";

import { StandardTable } from "@/components/table/StandardTable";
import { TableSearchInput } from "@/components/table/TableSearchInput";
import type { ETETableColumn } from "@/components/table/tableTypes";
import { createTextColumn } from "@/components/table/tableTypes";
import { FreshnessIndicator } from "./FreshnessIndicator";

export type JobTableRow = {
  id: string;
  title: string;
  customerName?: string | null;
  location?: string | null;
  source: string;
  createdAt: string;
  updatedAt?: string | null;
  latestMatchActivity?: string | null;
};

const globalFilterFn: FilterFn<JobTableRow> = (row, _columnId, filterValue) => {
  const query = typeof filterValue === "string" ? filterValue.trim().toLowerCase() : "";
  if (!query) return true;
  const values = [row.original.title, row.original.customerName ?? "", row.original.location ?? "", row.original.source];
  return values.some((value) => value?.toString().toLowerCase().includes(query));
};

export function JobTable({ jobs }: { jobs: JobTableRow[] }) {
  const columns = useMemo<ETETableColumn<JobTableRow>[]>(
    () => [
      {
        ...createTextColumn<JobTableRow, "title">({
          accessorKey: "title",
          header: "Title",
        }),
        cell: ({ row }) => (
          <div className="space-y-1">
            <Link href={`/jobs/${row.original.id}`} className="font-semibold text-indigo-700 hover:text-indigo-900">
              {row.original.title}
            </Link>
            <p className="text-xs text-slate-600">{row.original.location ?? "—"}</p>
          </div>
        ),
      },
      createTextColumn<JobTableRow, "customerName">({
        accessorKey: "customerName",
        header: "Customer",
        cell: ({ getValue }) => getValue<string | null>() ?? "—",
      }),
      createTextColumn<JobTableRow, "source">({
        accessorKey: "source",
        header: "Source",
        sortable: false,
        cell: ({ getValue }) => getValue<string>() || "—",
      }),
      {
        ...createTextColumn<JobTableRow, "createdAt">({
          accessorKey: "createdAt",
          header: "Created",
        }),
        sortingFn: (rowA, rowB) =>
          new Date(rowA.original.createdAt).getTime() - new Date(rowB.original.createdAt).getTime(),
        cell: ({ getValue }) => new Date(getValue<string>()).toLocaleString(),
      },
      {
        id: "freshness",
        header: "Freshness",
        enableSorting: false,
        cell: ({ row }) => (
          <FreshnessIndicator
            createdAt={new Date(row.original.createdAt)}
            updatedAt={row.original.updatedAt ? new Date(row.original.updatedAt) : undefined}
            latestMatchActivity={row.original.latestMatchActivity ? new Date(row.original.latestMatchActivity) : undefined}
          />
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <Link href={`/jobs/${row.original.id}`} className="text-blue-600 hover:text-blue-800">
            View
          </Link>
        ),
      },
    ],
    [],
  );

  return (
    <StandardTable
      data={jobs}
      columns={columns}
      sorting={{ initialState: [{ id: "createdAt", desc: true }] }}
      filtering={{ globalFilter: { initialState: "" }, globalFilterFn }}
      renderToolbar={(table) => (
        <TableSearchInput table={table} placeholder="Search by title, customer, or location" label="Search" />
      )}
      emptyState={<p className="py-8 text-center text-sm text-slate-600">No job requisitions available.</p>}
    />
  );
}
