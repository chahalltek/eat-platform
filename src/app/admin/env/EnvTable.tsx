"use client";

import { useMemo } from "react";
import type { FilterFn } from "@tanstack/react-table";

import { MonoText } from "@/components/MonoText";
import { StandardTable } from "@/components/table/StandardTable";
import { TableSearchInput } from "@/components/table/TableSearchInput";
import type { ETETableColumn } from "@/components/table/tableTypes";
import { createStatusBadgeColumn, createTextColumn } from "@/components/table/tableTypes";
import type { EnvEntry } from "@/lib/admin/env";

const globalFilterFn: FilterFn<EnvEntry> = (row, _columnId, filterValue) => {
  const query = typeof filterValue === "string" ? filterValue.trim().toLowerCase() : "";
  if (!query) return true;
  const values = [row.original.key, row.original.value ?? "", row.original.redacted ? "Redacted" : "Visible"];
  return values.some((value) => value?.toString().toLowerCase().includes(query));
};

export function EnvTable({ entries }: { entries: EnvEntry[] }) {
  const columns = useMemo<ETETableColumn<EnvEntry>[]>(
    () => [
      createTextColumn<EnvEntry, "key">({
        accessorKey: "key",
        header: "Key",
        cell: ({ getValue }) => (
          <MonoText className="text-xs text-slate-800 dark:text-slate-100">{getValue<string>()}</MonoText>
        ),
      }),
      createTextColumn<EnvEntry, "value">({
        accessorKey: "value",
        header: "Value",
        sortable: false,
        cell: ({ getValue }) => (
          <MonoText className="text-xs text-slate-800 dark:text-slate-100">
            {getValue<string | null>() ?? "—"}
          </MonoText>
        ),
      }),
      createStatusBadgeColumn<EnvEntry, "redacted">({
        accessorKey: "redacted",
        header: "Visibility",
        sortable: false,
        formatLabel: (value) => (value ? "Redacted" : "Visible"),
        getVariant: (value) => (value ? "warning" : "success"),
      }),
    ],
    [],
  );

  return (
    <StandardTable
      data={entries}
      columns={columns}
      filtering={{ globalFilter: { initialState: "" }, globalFilterFn }}
      renderToolbar={(table) => <TableSearchInput table={table} placeholder="Search entries" label="Search" />}
      emptyState={<p className="px-4 py-6 text-sm text-gray-500">No entries found.</p>}
      variant="compact"
    />
  );
}
