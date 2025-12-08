/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EATTable } from "./EATTable";
import { TableFilterDropdown } from "./TableFilterDropdown";
import { TableSearchInput } from "./TableSearchInput";
import { TableToolbar } from "./TableToolbar";
import type { EATTableColumn } from "./tableTypes";
import { createTextColumn } from "./tableTypes";

type ItemRow = { id: number; name: string; status: string; category: string };

const sampleRows: ItemRow[] = [
  { id: 1, name: "Alpha", status: "active", category: "engineering" },
  { id: 2, name: "Beta", status: "inactive", category: "engineering" },
  { id: 3, name: "Gamma", status: "active", category: "design" },
];

const statusOptions = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
];

const categoryOptions = [
  { label: "Engineering", value: "engineering" },
  { label: "Design", value: "design" },
];

const multiSelectFilter = (row: any, columnId: string, filterValue: unknown) => {
  const selections = Array.isArray(filterValue) ? (filterValue as string[]) : [];
  if (!selections.length) return true;
  const value = row.getValue<string>(columnId);
  return selections.includes(value);
};

const globalFilter = (row: any, _columnId: string, filterValue: unknown) => {
  const query = typeof filterValue === "string" ? filterValue.trim().toLowerCase() : "";
  if (!query) return true;
  return row.original.name.toLowerCase().includes(query);
};

function TestTable() {
  const columns: EATTableColumn<ItemRow>[] = [
    createTextColumn({ accessorKey: "name", header: "Name", sortable: false }),
    { ...createTextColumn({ accessorKey: "status", header: "Status", sortable: false }), filterFn: multiSelectFilter },
    { ...createTextColumn({ accessorKey: "category", header: "Category", sortable: false }), filterFn: multiSelectFilter },
  ];

  return (
    <EATTable
      data={sampleRows}
      columns={columns}
      filtering={{ columnFilters: { initialState: [] }, globalFilter: { initialState: "" }, globalFilterFn: globalFilter }}
    >
      {({ table, rows }) => (
        <div>
          <TableToolbar>
            <TableSearchInput table={table} placeholder="Search items" />
            <TableFilterDropdown table={table} columnId="status" label="Status" options={statusOptions} />
            <TableFilterDropdown table={table} columnId="category" label="Category" options={categoryOptions} />
          </TableToolbar>
          <ul>
            {rows.map((row) => (
              <li key={row.id}>{row.getValue("name") as string}</li>
            ))}
          </ul>
          {rows.length === 0 && <p>No results</p>}
        </div>
      )}
    </EATTable>
  );
}

function getRenderedItems() {
  return screen.getAllByRole("listitem").map((item) => item.textContent);
}

describe("Table filter components", () => {
  it("updates the global search filter and can be cleared", () => {
    render(<TestTable />);

    const searchInput = screen.getByPlaceholderText(/search items/i);
    expect(getRenderedItems()).toHaveLength(sampleRows.length);

    fireEvent.change(searchInput, { target: { value: "beta" } });
    expect(getRenderedItems()).toEqual(["Beta"]);

    fireEvent.click(screen.getByLabelText(/clear search/i));
    expect(getRenderedItems()).toHaveLength(sampleRows.length);
  });

  it("clears dropdown filters to restore the dataset", () => {
    render(<TestTable />);

    const statusButton = screen.getByRole("button", { name: /Status: All/i });
    fireEvent.click(statusButton);
    fireEvent.click(screen.getByLabelText("Active"));
    expect(getRenderedItems()).toEqual(["Alpha", "Gamma"]);

    fireEvent.click(screen.getByText("Clear"));
    expect(getRenderedItems()).toHaveLength(sampleRows.length);
  });

  it("supports combining multiple filters", () => {
    render(<TestTable />);

    fireEvent.click(screen.getByRole("button", { name: /Status: All/i }));
    fireEvent.click(screen.getByLabelText("Active"));

    fireEvent.click(screen.getByRole("button", { name: /Category: All/i }));
    fireEvent.click(screen.getByLabelText("Design"));

    fireEvent.change(screen.getByPlaceholderText(/search items/i), { target: { value: "ga" } });

    expect(getRenderedItems()).toEqual(["Gamma"]);
  });
});

