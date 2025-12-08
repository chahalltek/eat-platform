import { useMemo, useState } from "react";
import {
  ColumnDef,
  PaginationState,
  SortingState,
  Table,
  Updater,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

export type EATTableSorting = {
  initialState?: SortingState;
  onChange?: (sorting: SortingState) => void;
};

export type EATTablePagination = {
  initialState?: PaginationState;
  onChange?: (pagination: PaginationState) => void;
  pageCount?: number;
};

export type EATTableProps<TData> = {
  data: TData[];
  columns: ColumnDef<TData, any>[];
  sorting?: EATTableSorting;
  pagination?: EATTablePagination;
  children: (context: EATTableRenderProps<TData>) => React.ReactNode;
};

export type EATTableRenderProps<TData> = {
  table: Table<TData>;
  headerGroups: ReturnType<Table<TData>["getHeaderGroups"]>;
  rows: ReturnType<Table<TData>["getRowModel"]>["rows"];
  sorting: SortingState;
  pagination: PaginationState;
};

function resolveUpdaterValue<T>(updater: Updater<T>, previous: T): T {
  return typeof updater === "function" ? (updater as (old: T) => T)(previous) : updater;
}

export function useEATTable<TData>({
  data,
  columns,
  sorting,
  pagination,
}: Omit<EATTableProps<TData>, "children">): EATTableRenderProps<TData> {
  const [sortingState, setSortingState] = useState<SortingState>(sorting?.initialState ?? []);
  const [paginationState, setPaginationState] = useState<PaginationState>(
    pagination?.initialState ?? { pageIndex: 0, pageSize: pagination?.initialState?.pageSize ?? 10 },
  );

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

  const table = useReactTable({
    data: memoizedData,
    columns: memoizedColumns,
    state: {
      sorting: sortingState,
      pagination: paginationState,
    },
    onSortingChange: handleSortingChange,
    onPaginationChange: handlePaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: pagination?.pageCount !== undefined,
    pageCount: pagination?.pageCount,
  });

  return {
    table,
    headerGroups: table.getHeaderGroups(),
    rows: table.getRowModel().rows,
    sorting: sortingState,
    pagination: paginationState,
  };
}

export function EATTable<TData>({ children, ...props }: EATTableProps<TData>) {
  const tableContext = useEATTable(props);
  return <>{children(tableContext)}</>;
}
