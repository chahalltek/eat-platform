import { describe, expect, it, expectTypeOf } from "vitest";
import React from "react";
import {
  EATTableColumn,
  StatusVariant,
  createNumberColumn,
  createStatusBadgeColumn,
  createTextColumn,
} from "./tableTypes";

const numberFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type PersonRow = {
  id: string;
  name: string;
  age: number;
  status: "active" | "inactive" | "pending";
};

describe("tableTypes helpers", () => {
  it("creates a text column definition with sorting enabled by default", () => {
    const column = createTextColumn<PersonRow>({ accessorKey: "name", header: "Name" });

    expect(column.accessorKey).toBe("name");
    expect(column.enableSorting).toBe(true);
    expectTypeOf(column).toMatchTypeOf<EATTableColumn<PersonRow>>();

    const rendered = column.cell?.({ getValue: () => "Alice" } as any);

    expect(rendered).toBe("Alice");
  });

  it("normalizes falsy text values to empty strings", () => {
    const column = createTextColumn<PersonRow>({ accessorKey: "name", header: "Name" });

    const renderedNull = column.cell?.({ getValue: () => null } as any);
    const renderedUndefined = column.cell?.({ getValue: () => undefined } as any);

    expect(renderedNull).toBe("");
    expect(renderedUndefined).toBe("");
  });

  it("allows overriding the text cell renderer and sorting flag", () => {
    const column = createTextColumn<PersonRow>({
      accessorKey: "name",
      header: "Name",
      sortable: false,
      cell: ({ getValue }) => getValue().toUpperCase(),
    });

    expect(column.enableSorting).toBe(false);

    const rendered = column.cell?.({ getValue: () => "bob" } as any);

    expect(rendered).toBe("BOB");
  });

  it("creates a number column with formatting and sorting enabled by default", () => {
    const column = createNumberColumn<PersonRow>({ accessorKey: "age", header: "Age" });

    expect(column.accessorKey).toBe("age");
    expect(column.enableSorting).toBe(true);

    const rendered = column.cell?.({ getValue: () => 42 } as any);

    expect(rendered).toBe(42);
  });

  it("formats numbers when a formatter is provided", () => {
    const column = createNumberColumn<PersonRow>({
      accessorKey: "age",
      header: "Age",
      formatValue: (value) => numberFormatter.format(value),
    });

    const rendered = column.cell?.({ getValue: () => 18.1 } as any);

    expect(rendered).toBe("18.10");
  });

  it("returns an empty string for non-number inputs", () => {
    const column = createNumberColumn<PersonRow>({ accessorKey: "age", header: "Age" });

    const rendered = column.cell?.({ getValue: () => undefined } as any);

    expect(rendered).toBe("");
  });

  it("creates a status badge column with sorting disabled by default", () => {
    const column = createStatusBadgeColumn<PersonRow>({ accessorKey: "status", header: "Status" });

    expect(column.enableSorting).toBe(false);

    const rendered = column.cell?.({ getValue: () => "active" } as any) as JSX.Element;

    expect(rendered.type).toBe("span");
    expect(rendered.props.className).toContain("rounded-full");
    expect(rendered.props.children).toBe("active");
  });

  it("applies formatting and variant mapping for status badges", () => {
    const column = createStatusBadgeColumn<PersonRow>({
      accessorKey: "status",
      header: "Status",
      sortable: true,
      formatLabel: (value) => `${String(value).toUpperCase()} STATUS`,
      getVariant: (value): StatusVariant => {
        if (value === "active") return "success";
        if (value === "inactive") return "error";
        return "warning";
      },
    });

    expect(column.enableSorting).toBe(true);

    const rendered = column.cell?.({ getValue: () => "inactive" } as any) as JSX.Element;

    expect(rendered.props.className.includes("bg-red-100")).toBe(true);
    expect(rendered.props.children).toBe("INACTIVE STATUS");
  });

  it("falls back to a neutral badge variant and default label when no helpers are provided", () => {
    const column = createStatusBadgeColumn<PersonRow>({ accessorKey: "status", header: "Status" });

    const rendered = column.cell?.({ getValue: () => null } as any) as JSX.Element;

    expect(rendered.props.className.includes("bg-gray-100")).toBe(true);
    expect(rendered.props.children).toBe("");
  });

  it("enforces correct accessor keys and headers at compile time", () => {
    createTextColumn<PersonRow>({ accessorKey: "name", header: "Name" });
    createNumberColumn<PersonRow>({ accessorKey: "age", header: "Age" });
    createStatusBadgeColumn<PersonRow>({ accessorKey: "status", header: "Status" });

    // @ts-expect-error - accessorKey must be a valid key on the data object
    createTextColumn<PersonRow>({ accessorKey: "unknown", header: "Invalid" });

    // @ts-expect-error - header is required
    createNumberColumn<PersonRow>({ accessorKey: "age" });

    // @ts-expect-error - status column cannot omit accessorKey
    createStatusBadgeColumn<PersonRow>({ header: "Status" });
  });
});
