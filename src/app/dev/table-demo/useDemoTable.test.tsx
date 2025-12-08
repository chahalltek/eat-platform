/**
 * @vitest-environment jsdom
 */

import { act, renderHook } from "@testing-library/react";

import { demoColumns, useDemoTable } from "./useDemoTable";

describe("useDemoTable", () => {
  it("exposes typed column definitions", () => {
    const headers = demoColumns.map((column) => column.id ?? column.accessorKey);

    expect(headers).toContain("name");
    expect(headers).toContain("score");
    expect(headers?.length).toBeGreaterThanOrEqual(4);
  });

  it("toggles sorting state for sortable columns", () => {
    const { result } = renderHook(() => useDemoTable());

    expect(result.current.sorting).toEqual([]);

    act(() => {
      result.current.table.getColumn("score")?.toggleSorting();
    });

    const firstSort = result.current.sorting[0];

    expect(firstSort?.id).toBe("score");

    act(() => {
      result.current.table.getColumn("score")?.toggleSorting();
    });

    expect(result.current.sorting[0]?.id).toBe("score");
    expect(result.current.sorting[0]?.desc).toBe(!firstSort?.desc);
  });

  it("matches the initial dataset snapshot", () => {
    const { result } = renderHook(() => useDemoTable());

    const rows = result.current.table.getRowModel().rows.map((row) => row.original.name);

    expect(rows).toMatchSnapshot();
  });
});
