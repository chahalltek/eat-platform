import React from "react";
import { render } from "@testing-library/react";
import type { Table } from "@tanstack/react-table";
import type { FilterFn } from "@tanstack/table-core";

import { EATTable } from "../EATTable";
import type { EATTableColumn } from "../tableTypes";
import { createNumberColumn, createStatusBadgeColumn, createTextColumn } from "../tableTypes";

export type MockTableRow = {
  id: number;
  name: string;
  age: number;
  status: "active" | "inactive";
  category: "engineering" | "design";
};

export type MockTableOverrides = Partial<MockTableRow> | ((row: MockTableRow, index: number) => Partial<MockTableRow>);

export function createMockTableData({
  count = 3,
  overrides,
}: { count?: number; overrides?: MockTableOverrides } = {}): MockTableRow[] {
  const baseRows: MockTableRow[] = [
    { id: 1, name: "Alpha", age: 30, status: "active", category: "engineering" },
    { id: 2, name: "Beta", age: 24, status: "inactive", category: "engineering" },
    { id: 3, name: "Gamma", age: 35, status: "active", category: "design" },
    { id: 4, name: "Delta", age: 29, status: "inactive", category: "design" },
  ];

  const rows = baseRows.slice(0, Math.max(1, Math.min(count, baseRows.length)));

  if (!overrides) return rows;

  return rows.map((row, index) => ({
    ...row,
    ...(typeof overrides === "function" ? overrides(row, index) : overrides),
  }));
}

export const multiSelectFilter: FilterFn<MockTableRow> = (row, columnId, filterValue) => {
  const selections = Array.isArray(filterValue) ? (filterValue as string[]) : [];
  if (!selections.length) return true;
  const value = row.getValue<string>(columnId);
  return selections.includes(value);
};

export const globalTextFilter: FilterFn<MockTableRow> = (row, _columnId, filterValue) => {
  const query = typeof filterValue === "string" ? filterValue.trim().toLowerCase() : "";
  if (!query) return true;
  return row.original.name.toLowerCase().includes(query);
};

export function createMockColumns({ enableSorting = true, includeFilters = false } = {}): EATTableColumn<MockTableRow>[] {
  return [
    createTextColumn({ accessorKey: "name", header: "Name", sortable: enableSorting }),
    createNumberColumn({ accessorKey: "age", header: "Age", sortable: enableSorting }),
    {
      ...createTextColumn({ accessorKey: "status", header: "Status", sortable: enableSorting }),
      ...(includeFilters ? { filterFn: multiSelectFilter } : {}),
    },
    {
      ...createStatusBadgeColumn({ accessorKey: "category", header: "Category", sortable: false }),
      ...(includeFilters ? { filterFn: multiSelectFilter } : {}),
    },
  ];
}

type HarnessInstance = {
  table: Table<MockTableRow>;
  getColumnValues: (columnId: keyof MockTableRow) => (string | number)[];
  expectSortedBy: (columnId: keyof MockTableRow, direction?: "asc" | "desc") => void;
  expectFilteredRows: (names: string[]) => void;
};

type RenderHarnessOptions = {
  data?: MockTableRow[];
  columns?: EATTableColumn<MockTableRow>[];
  enableFiltering?: boolean;
};

export function renderTableHarness(options: RenderHarnessOptions = {}): HarnessInstance {
  const { data = createMockTableData(), columns = createMockColumns(), enableFiltering = false } = options;
  const tableRef: { table?: Table<MockTableRow> } = {};

  render(
    <EATTable
      data={data}
      columns={columns}
      filtering={
        enableFiltering
          ? {
              columnFilters: { initialState: [] },
              globalFilter: { initialState: "" },
              globalFilterFn: globalTextFilter,
            }
          : undefined
      }
    >
      {({ table, rows }) => {
        tableRef.table = table;
        return (
          <div>
            <ul data-testid="table-rows">
              {rows.map((row) => (
                <li key={row.id} data-testid="table-row">
                  {row.getValue("name") as string}
                </li>
              ))}
            </ul>
            {rows.length === 0 && <p data-testid="empty-state">No results</p>}
          </div>
        );
      }}
    </EATTable>,
  );

  if (!tableRef.table) throw new Error("Table was not initialized");

  const getColumnValues = (columnId: keyof MockTableRow) =>
    tableRef.table!.getRowModel().rows.map((row) => row.getValue(columnId) as string | number);

  const expectSortedBy = (columnId: keyof MockTableRow, direction: "asc" | "desc" = "asc") => {
    const values = getColumnValues(columnId);
    const sorted = [...values].sort((a, b) => (a > b ? 1 : -1));
    const expectedOrder = direction === "asc" ? sorted : [...sorted].reverse();
    expect(values).toEqual(expectedOrder);
  };

  const expectFilteredRows = (names: string[]) => {
    expect(getColumnValues("name")).toEqual(names);
  };

  return { table: tableRef.table, getColumnValues, expectSortedBy, expectFilteredRows };
}
