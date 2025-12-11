import { useMemo, useState } from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  FilterFn,
  PaginationState,
  SortingState,
  Table,
  Updater,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { TableStylePreset, TableStyleVariant, getTableStyles } from "./tableStyles";

export type ETETableSorting = {
  initialState?: SortingState;
  onChange?: (sorting: SortingState) => void;
};

export type ETETablePagination = {
  initialState?: PaginationState;
  onChange?: (pagination: PaginationState) => void;
  pageCount?: number;
};

export type ETETableProps<TData> = {
  data: TData[];
  columns: ColumnDef<TData, any>[];
  sorting?: ETETableSorting;
  pagination?: ETETablePagination;
  filtering?: ETETableFiltering<TData>;
  variant?: TableStyleVariant;
  children: (context: ETETableRenderProps<TData>) => React.ReactNode;
};

export type ETETableRenderProps<TData> = {
  table: Table<TData>;
  headerGroups: ReturnType<Table<TData>["getHeaderGroups"]>;
  rows: ReturnType<Table<TData>["getRowModel"]>["rows"];
  sorting: SortingState;
  pagination: PaginationState;
  columnFilters: ColumnFiltersState;
  globalFilter: string;
  styles: TableStylePreset;
};

export type ETETableFiltering<TData> = {
  columnFilters?: {
    initialState?: ColumnFiltersState;
    onChange?: (filters: ColumnFiltersState) => void;
  };
  globalFilter?: {
    initialState?: string;
    onChange?: (value: string) => void;
    enabled?: boolean;
  };
  filterFns?: Record<string, FilterFn<TData>>;
  globalFilterFn?: FilterFn<TData>;
};

function resolveUpdaterValue<T>(updater: Updater<T>, previous: T): T {
  return typeof updater === "function" ? (updater as (old: T) => T)(previous) : updater;
}

export function useETETable<TData>({
  data,
  columns,
  sorting,
  pagination,
  filtering,
  variant = "comfortable",
}: Omit<ETETableProps<TData>, "children">): ETETableRenderProps<TData> {
  const [sortingState, setSortingState] = useState<SortingState>(sorting?.initialState ?? []);
  const [paginationState, setPaginationState] = useState<PaginationState>(
    pagination?.initialState ?? { pageIndex: 0, pageSize: pagination?.initialState?.pageSize ?? 10 },
  );
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(filtering?.columnFilters?.initialState ?? []);
  const [globalFilter, setGlobalFilter] = useState<string>(filtering?.globalFilter?.initialState ?? "");

  const memoizedData = useMemo(() => data, [data]);
  const memoizedColumns = useMemo(() => columns, [columns]);

  const handleSortingChange = (updater: Updater<SortingState>) => {
    const nextState = resolveUpdaterValue(updater, sortingState);
    setSortingState(nextState);
    sorting?.onChange?.(nextState);
  };

  const handlePaginationChange = (updater: Updater<PaginationState>) => {
    const nextState = resolveUpdaterValue(updater, paginationState);
    setPaginationState(nextState);
    pagination?.onChange?.(nextState);
  };

  const handleColumnFiltersChange = (updater: Updater<ColumnFiltersState>) => {
    const nextState = resolveUpdaterValue(updater, columnFilters);
    setColumnFilters(nextState);
    filtering?.columnFilters?.onChange?.(nextState);
  };

  const handleGlobalFilterChange = (updater: Updater<string>) => {
    const nextState = resolveUpdaterValue(updater, globalFilter);
    setGlobalFilter(nextState);
    filtering?.globalFilter?.onChange?.(nextState);
  };

  const styles = useMemo(() => getTableStyles(variant), [variant]);

  const table = useReactTable({
    data: memoizedData,
    columns: memoizedColumns,
    state: {
      sorting: sortingState,
      pagination: paginationState,
      columnFilters,
      globalFilter: filtering?.globalFilter?.enabled === false ? undefined : globalFilter,
    },
    onSortingChange: handleSortingChange,
    onPaginationChange: handlePaginationChange,
    onColumnFiltersChange: handleColumnFiltersChange,
    onGlobalFilterChange: handleGlobalFilterChange,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    filterFns: filtering?.filterFns,
    globalFilterFn: filtering?.globalFilterFn,
    manualPagination: pagination?.pageCount !== undefined,
    pageCount: pagination?.pageCount,
  });

  return {
    table,
    headerGroups: table.getHeaderGroups(),
    rows: table.getRowModel().rows,
    sorting: sortingState,
    pagination: paginationState,
    columnFilters,
    globalFilter,
    styles,
  };
}

export function ETETable<TData>({ children, ...props }: ETETableProps<TData>) {
  const tableContext = useETETable(props);
  return <>{children(tableContext)}</>;
}

export { flexRender };
