/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { StandardTable } from "./StandardTable";
import type { EATTableColumn } from "./tableTypes";
import { createTextColumn } from "./tableTypes";
import { TableSearchInput } from "./TableSearchInput";

interface RowData {
  id: number;
  name: string;
  city: string;
}

describe("StandardTable", () => {
  const data: RowData[] = [
    { id: 1, name: "Alice", city: "Austin" },
    { id: 2, name: "Bob", city: "Boston" },
  ];

  const columns: EATTableColumn<RowData>[] = [
    createTextColumn<RowData, "name">({ accessorKey: "name", header: "Name" }),
    createTextColumn<RowData, "city">({ accessorKey: "city", header: "City", sortable: false }),
  ];

  it("renders rows with headers", () => {
    render(<StandardTable data={data} columns={columns} />);

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Boston")).toBeInTheDocument();
  });

  it("supports global filtering via the toolbar", async () => {
    const filterFn = vi.fn((row: any, _columnId: string, filterValue: string) =>
      row.original.name.toLowerCase().includes(filterValue.toLowerCase()),
    );

    render(
      <StandardTable
        data={data}
        columns={columns}
        filtering={{ globalFilter: { initialState: "" }, globalFilterFn: filterFn }}
        renderToolbar={(table) => (
          <TableSearchInput table={table} label="Search" placeholder="Search names" />
        )}
      />,
    );

    const input = screen.getByLabelText("Search");
    fireEvent.change(input, { target: { value: "ali" } });

    expect(screen.queryByText("Bob")).not.toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });
});
