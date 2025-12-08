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
import { createMockColumns, createMockTableData, globalTextFilter } from "./testing/tableHarness";

const sampleRows = createMockTableData();

function TestTable() {
  const columns = createMockColumns({ enableSorting: false, includeFilters: true });

  return (
    <EATTable
      data={createMockTableData()}
      columns={columns}
      filtering={{ columnFilters: { initialState: [] }, globalFilter: { initialState: "" }, globalFilterFn: globalTextFilter }}
    >
      {({ table, rows }) => (
        <div>
          <TableToolbar>
            <TableSearchInput table={table} placeholder="Search items" />
            <TableFilterDropdown
              table={table}
              columnId="status"
              label="Status"
              options={[
                { label: "Active", value: "active" },
                { label: "Inactive", value: "inactive" },
              ]}
            />
            <TableFilterDropdown
              table={table}
              columnId="category"
              label="Category"
              options={[
                { label: "Engineering", value: "engineering" },
                { label: "Design", value: "design" },
              ]}
            />
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

