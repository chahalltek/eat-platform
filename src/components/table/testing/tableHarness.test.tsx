/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ETETable } from "../ETETable";
import { TableFilterDropdown } from "../TableFilterDropdown";
import { TableSearchInput } from "../TableSearchInput";
import { TableToolbar } from "../TableToolbar";
import type { ETETableColumn } from "../tableTypes";
import {
  MockTableRow,
  createMockColumns,
  createMockTableData,
  globalTextFilter,
  multiSelectFilter,
  renderTableHarness,
} from "./tableHarness";

describe("table test harness", () => {
  it("creates repeatable mock rows and allows overrides", () => {
    const rows = createMockTableData({ count: 2, overrides: { status: "inactive" } });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ name: "Alpha", status: "inactive" });
    expect(rows[1]).toMatchObject({ name: "Beta", status: "inactive" });
  });

  it("builds columns using shared helpers and optional filters", () => {
    const sortableColumns = createMockColumns({ enableSorting: true, includeFilters: true });

    expect(sortableColumns).toHaveLength(4);
    expect(sortableColumns[0]).toMatchObject({ accessorKey: "name", enableSorting: true });
    expect(sortableColumns[1]).toMatchObject({ accessorKey: "age", enableSorting: true });
    expect(sortableColumns[2]).toHaveProperty("filterFn", multiSelectFilter);
    expect(sortableColumns[3]).toHaveProperty("filterFn", multiSelectFilter);
  });

  it("runs common sorting assertions against the rendered table", () => {
    const { table, expectSortedBy } = renderTableHarness();

    act(() => {
      table.setSorting([{ id: "age", desc: true }]);
    });
    expectSortedBy("age", "desc");

    act(() => {
      table.setSorting([{ id: "age", desc: false }]);
    });
    expectSortedBy("age", "asc");
  });

  it("supports filtering assertions via column and global filters", () => {
    const columns: ETETableColumn<MockTableRow>[] = createMockColumns({ includeFilters: true });

    render(
      <ETETable
        data={createMockTableData()}
        columns={columns}
        filtering={{
          columnFilters: { initialState: [] },
          globalFilter: { initialState: "" },
          globalFilterFn: globalTextFilter,
        }}
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
            </TableToolbar>
            <ul>
              {rows.map((row) => (
                <li key={row.id}>{row.getValue("name") as string}</li>
              ))}
            </ul>
            {rows.length === 0 && <p>No results</p>}
          </div>
        )}
      </ETETable>,
    );

    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Alpha", "Beta", "Gamma"]);

    fireEvent.change(screen.getByPlaceholderText(/search items/i), { target: { value: "ga" } });
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Gamma"]);

    fireEvent.click(screen.getByRole("button", { name: /Status: All/i }));
    fireEvent.click(screen.getByLabelText("Active"));
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Gamma"]);
  });
});
