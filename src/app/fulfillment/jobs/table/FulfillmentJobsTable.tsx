"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { FilterFn } from "@tanstack/react-table";

import { StandardTable } from "@/components/table/StandardTable";
import { TableFilterDropdown } from "@/components/table/TableFilterDropdown";
import { TableSearchInput } from "@/components/table/TableSearchInput";
import type { ETETableColumn } from "@/components/table/tableTypes";
import { createStatusBadgeColumn, createTextColumn } from "@/components/table/tableTypes";
import type { FulfillmentJobRecord } from "../data";

export type FulfillmentJobRow = FulfillmentJobRecord;

const globalFilterFn: FilterFn<FulfillmentJobRow> = (row, _columnId, filterValue) => {
  const query = typeof filterValue === "string" ? filterValue.trim().toLowerCase() : "";
  if (!query) return true;
  const values = [
    row.original.title,
    row.original.client,
    row.original.owner,
    row.original.priority,
    row.original.status,
    row.original.location ?? "",
  ];
  return values.some((value) => value?.toString().toLowerCase().includes(query));
};

const multiSelectFilter: FilterFn<FulfillmentJobRow> = (row, columnId, filterValue) => {
  const selections = Array.isArray(filterValue) ? filterValue : [];
  if (selections.length === 0) return true;
  const value = row.getValue<string | string[] | null>(columnId) ?? "";
  if (Array.isArray(value)) return value.some((entry) => selections.includes(String(entry)));
  return selections.includes(String(value));
};

export function FulfillmentJobsTable({ jobs }: { jobs: FulfillmentJobRow[] }) {
  const router = useRouter();

  const statusOptions = useMemo(() => {
    const statuses = Array.from(new Set(jobs.map((job) => job.status))).filter(Boolean).sort();
    return statuses.map((status) => ({ value: status, label: status }));
  }, [jobs]);

  const priorityOptions = useMemo(() => {
    const priorities = Array.from(new Set(jobs.map((job) => job.priority))).filter(Boolean).sort();
    return priorities.map((priority) => ({ value: priority, label: priority }));
  }, [jobs]);

  const ownerOptions = useMemo(() => {
    const owners = Array.from(new Set(jobs.map((job) => job.owner))).filter(Boolean).sort();
    return owners.map((owner) => ({ value: owner, label: owner }));
  }, [jobs]);

  const columns = useMemo<ETETableColumn<FulfillmentJobRow>[]>(
    () => [
      {
        ...createTextColumn<FulfillmentJobRow, "title">({
          accessorKey: "title",
          header: "Job",
        }),
        cell: ({ row }) => (
          <div className="space-y-1">
            <p className="font-semibold text-indigo-700">{row.original.title}</p>
            <p className="text-xs text-slate-600">{row.original.location ?? "—"}</p>
          </div>
        ),
      },
      createTextColumn<FulfillmentJobRow, "client">({
        accessorKey: "client",
        header: "Client",
        cell: ({ getValue }) => getValue<string>() ?? "—",
        filterFn: multiSelectFilter,
      }),
      createTextColumn<FulfillmentJobRow, "priority">({
        accessorKey: "priority",
        header: "Priority",
        filterFn: multiSelectFilter,
      }),
      createTextColumn<FulfillmentJobRow, "status">({
        accessorKey: "status",
        header: "Status",
        filterFn: multiSelectFilter,
      }),
      {
        ...createTextColumn<FulfillmentJobRow, "updatedAt">({
          accessorKey: "updatedAt",
          header: "Updated",
        }),
        sortingFn: (rowA, rowB) =>
          new Date(rowA.original.updatedAt).getTime() - new Date(rowB.original.updatedAt).getTime(),
        cell: ({ getValue }) => new Date(getValue<string>()).toLocaleString(),
      },
      createTextColumn<FulfillmentJobRow, "owner">({
        accessorKey: "owner",
        header: "Owner",
        filterFn: multiSelectFilter,
      }),
      {
        ...createStatusBadgeColumn<FulfillmentJobRow, "needsAction">({
          accessorKey: "needsAction",
          header: "Needs Action",
          sortable: false,
          formatLabel: (value) => (value ? "Yes" : "No"),
          getVariant: (value) => (value ? "warning" : "success"),
        }),
        enableSorting: false,
        enableColumnFilter: false,
      },
    ],
    [],
  );

  return (
    <StandardTable
      data={jobs}
      columns={columns}
      tableLabel="Fulfillment jobs"
      sorting={{ initialState: [{ id: "updatedAt", desc: true }] }}
      filtering={{
        columnFilters: { initialState: [] },
        globalFilter: { initialState: "" },
        globalFilterFn,
      }}
      renderToolbar={(table) => (
        <div className="flex flex-wrap items-center gap-3">
          <TableSearchInput
            table={table}
            placeholder="Search by job, client, or owner"
            label="Search"
            className="w-full md:w-80"
          />
          <TableFilterDropdown table={table} columnId="status" label="Status" options={statusOptions} />
          <TableFilterDropdown table={table} columnId="priority" label="Priority" options={priorityOptions} />
          <TableFilterDropdown table={table} columnId="owner" label="Owner" options={ownerOptions} />
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {table.getRowModel().rows.length} results
          </p>
        </div>
      )}
      getRowOptions={(row) => ({
        onClick: () => router.push(`/fulfillment/jobs/${row.original.id}`),
        className: "cursor-pointer",
      })}
      emptyState={<p className="py-6 text-center text-sm text-slate-600">No fulfillment jobs available.</p>}
    />
  );
}
