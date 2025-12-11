/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi } from "vitest";
import { render, renderHook, screen, act } from "@testing-library/react";
import { flexRender } from "@tanstack/react-table";
import { ETETable, useETETable } from "./ETETable";
import { MockTableRow, createMockColumns, createMockTableData } from "./testing/tableHarness";

describe("ETETable", () => {
  const people = createMockTableData({ count: 3 });
  const columns = createMockColumns({ enableSorting: true });

  it("creates a table instance with provided columns and data", () => {
    render(
      <ETETable data={people} columns={columns}>
        {({ headerGroups, rows }) => (
          <table>
            <thead>
              {headerGroups.map((headerGroup) => (
                <tr key={headerGroup.id} role="row">
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} role="columnheader">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} role="row">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} role="cell">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ETETable>,
    );

    expect(screen.getByRole("columnheader", { name: "Name" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Age" })).toBeTruthy();
    expect(screen.getAllByRole("row")).toHaveLength(people.length + 1);
    expect(screen.getAllByRole("cell")).toHaveLength(people.length * columns.length);
  });

  it("updates sorting state and invokes callbacks when sorting changes", () => {
    const onSortingChange = vi.fn();
    const { result } = renderHook(() =>
      useETETable<MockTableRow>({
        data: people,
        columns,
        sorting: { initialState: [], onChange: onSortingChange },
      }),
    );

    act(() => {
      result.current.table.setSorting([{ id: "age", desc: true }]);
    });

    expect(onSortingChange).toHaveBeenCalledWith([{ id: "age", desc: true }]);
    expect(result.current.sorting).toEqual([{ id: "age", desc: true }]);

    act(() => {
      result.current.table.setSorting((previous) => previous.map((entry) => ({ ...entry, desc: false })));
    });

    expect(onSortingChange).toHaveBeenLastCalledWith([{ id: "age", desc: false }]);
    expect(result.current.sorting).toEqual([{ id: "age", desc: false }]);
  });

  it("updates pagination state and invokes callbacks when pagination changes", () => {
    const onPaginationChange = vi.fn();
    const { result } = renderHook(() =>
      useETETable<MockTableRow>({
        data: people,
        columns,
        pagination: { initialState: { pageIndex: 0, pageSize: 1 }, onChange: onPaginationChange, pageCount: 10 },
      }),
    );

    act(() => {
      result.current.table.setPageIndex(2);
    });

    expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 2, pageSize: 1 });
    expect(result.current.pagination).toEqual({ pageIndex: 2, pageSize: 1 });

    act(() => {
      result.current.table.setPagination((previous) => ({ ...previous, pageSize: 3 }));
    });

    expect(onPaginationChange).toHaveBeenLastCalledWith({ pageIndex: 2, pageSize: 3 });
    expect(result.current.pagination).toEqual({ pageIndex: 2, pageSize: 3 });
    expect(result.current.table.options.pageCount).toBe(10);
  });

  it("exposes style presets based on the provided variant", () => {
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useETETable<MockTableRow>>[0]) => useETETable<MockTableRow>(props),
      {
        initialProps: { data: people, columns, variant: "comfortable" },
      },
    );

    expect(result.current.styles.variant).toBe("comfortable");
    expect(result.current.styles.classes.cell).toContain("py-3");

    rerender({ data: people, columns, variant: "compact" });

    expect(result.current.styles.variant).toBe("compact");
    expect(result.current.styles.classes.cell).toContain("py-2");
  });
});
