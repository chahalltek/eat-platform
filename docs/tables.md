# TanStack Table in EAT

This guide documents how we use [TanStack Table](https://tanstack.com/table) across EAT. It explains the reasoning behind our stack, the EATTable abstraction, and the repeatable steps for creating and testing tables so the approach is sustainable across the organization.

## Why TanStack Table

- **Headless first.** TanStack Table manages state (sorting, pagination, filtering) without imposing markup, letting us pair it with our design system and accessibility patterns.
- **Full control.** We own table rendering and behaviors, so product teams can ship bespoke experiences (toolbars, row actions, badges) without fighting default UI constraints.
- **Reusable foundations.** Shared helpers (column factories, style presets, toolbar slots) keep tables consistent while still allowing feature-level flexibility.

## The EATTable abstraction

`EATTable` is a thin wrapper over `useReactTable` that centralizes common setup (state wiring, style presets) while keeping rendering customizable via a render-prop.

- `useEATTable` wires TanStack state, memoizes data/columns, and exposes sorting, filtering, pagination, and style presets. 【F:src/components/table/EATTable.tsx†L43-L112】
- `EATTable` renders children with that context so callers can decide the markup. 【F:src/components/table/EATTable.tsx†L114-L119】
- `StandardTable` is the primary consumer: it renders headers, rows, and empty states using the provided columns, style variant, and optional toolbar slot. Prefer it unless you need fully custom structure. 【F:src/components/table/StandardTable.tsx†L15-L96】
- Column helper factories (`createTextColumn`, `createNumberColumn`, `createStatusBadgeColumn`) generate strongly typed column definitions with common defaults. 【F:src/components/table/tableTypes.tsx†L18-L71】

## Creating a new table

1) **Define the data type.** Start with a typed row model that matches your API response or view model. Keep field names stable; column helpers use accessor keys.

```ts
export type CandidateRow = {
  id: string;
  name: string;
  status: "active" | "archived";
  score: number;
};
```

2) **Define columns via helpers.** Use the factories in `tableTypes.tsx` to enable sorting and formatting by default, and add custom `cell` renderers when needed.

```ts
const columns: EATTableColumn<CandidateRow>[] = [
  createTextColumn({ accessorKey: "name", header: "Name" }),
  createStatusBadgeColumn({ accessorKey: "status", header: "Status" }),
  createNumberColumn({ accessorKey: "score", header: "Score", sortable: true, formatValue: (value) => `${value}%` }),
];
```

3) **Render with `StandardTable` or `EATTable`.** Use `StandardTable` for the common case (built-in header, row styles, empty state). Drop down to `EATTable` if you need fully custom markup.

```tsx
<StandardTable
  data={rows}
  columns={columns}
  sorting={{ initialState: [{ id: "score", desc: true }] }}
  variant="comfortable"
  renderToolbar={(table) => <MyFilters table={table} />}
  emptyState={<p>No candidates</p>}
/>
```

4) **Add filters and toolbars.** Pass filtering config to enable per-column or global search, and render a toolbar component (e.g., chips, selects) with the table instance. Use filter functions when you need custom logic.

```tsx
<StandardTable
  data={rows}
  columns={columns.map((column) =>
    column.accessorKey === "status"
      ? { ...column, filterFn: statusFilter }
      : column
  )}
  filtering={{
    columnFilters: { initialState: [] },
    globalFilter: { initialState: "" },
    filterFns: { status: statusFilter },
    globalFilterFn: globalTextFilter,
  }}
  renderToolbar={(table) => <StatusToolbar table={table} />}
/>
```

5) **Add tests using the table harness.** The table harness exposes helpers for rendering `EATTable` with mock data and asserting sorting/filtering behaviors.

- `renderTableHarness` renders a lightweight table and returns the underlying `table` plus helpers such as `expectSortedBy` and `expectFilteredRows`. 【F:src/components/table/testing/tableHarness.tsx†L55-L115】
- Swap in custom columns or filters via the harness options to cover feature-specific logic.

```ts
import { renderTableHarness, createMockColumns, createMockTableData } from "@/components/table/testing/tableHarness";

const { table, expectSortedBy } = renderTableHarness({
  data: createMockTableData(),
  columns: createMockColumns({ includeFilters: true }),
  enableFiltering: true,
});

table.getColumn("age")?.toggleSorting(false);
expectSortedBy("age", "desc");
```

## Do / Don’t

- ✅ **Do** define a typed row model and reuse `createTextColumn`/`createNumberColumn`/`createStatusBadgeColumn` to keep sorting and formatting consistent.
- ✅ **Do** memoize column definitions inside components (e.g., `useMemo`) to avoid unnecessary re-renders and to keep referential equality. 【F:src/app/candidates/CandidateTable.tsx†L27-L108】
- ✅ **Do** use `StandardTable` for typical list/detail tables; it already wires `flexRender`, styles, empty states, and toolbar placement. 【F:src/components/table/StandardTable.tsx†L29-L96】
- ❌ **Don’t** bypass `EATTable` state management by rolling your own `useReactTable` setup unless you have a strong reason; shared behavior (filtering, pagination wiring, style presets) will be lost. 【F:src/components/table/EATTable.tsx†L43-L112】
- ❌ **Don’t** inline untyped column objects when helper factories cover the same case—prefer helpers to keep headers, sorting flags, and cell formatting aligned. 【F:src/components/table/tableTypes.tsx†L18-L71】

## References

- Example implementations: `src/app/candidates/CandidateTable.tsx`, `src/app/jobs/JobTable.tsx`, `src/app/agents/runs/AgentRunsTable.tsx`.
- Core API surface: `src/components/table/EATTable.tsx`, `src/components/table/StandardTable.tsx`, `src/components/table/tableTypes.tsx`.
- Testing utilities: `src/components/table/testing/tableHarness.tsx`.
