/**
 * @vitest-environment jsdom
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { demoData, useDemoTable } from "./useDemoTable";

describe("useDemoTable", () => {
  it("exposes typed column definitions", () => {
    const { result } = renderHook(() => useDemoTable());
    const headers = result.current.columns.map((column) => column.id ?? column.accessorKey);

    expect(headers).toContain("name");
    expect(headers).toContain("score");
    expect(result.current.columns).toHaveLength(5);
  });

  it("returns the demo dataset", () => {
    const { result } = renderHook(() => useDemoTable());

    expect(result.current.data).toEqual(demoData);
  });

  it("matches the global filter shape", () => {
    const { result } = renderHook(() => useDemoTable());

    expect(typeof result.current.globalFilterFn).toBe("function");
    expect(result.current.globalFilterFn({ original: demoData[0] } as any, "name", "alex")).toBe(true);
  });
});
