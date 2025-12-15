"use client";

import clsx from "clsx";
import type { Row, Table } from "@tanstack/react-table";
import { ETETable, type ETETableFiltering, type ETETableSorting, flexRender } from "./ETETable";
import { TableToolbar } from "./TableToolbar";
import { getTableCellClasses, getTableClassNames, getTableRowClasses } from "./tableStyles";
import type { TableStyleVariant } from "./tableStyles";
import type { ETETableColumn } from "./tableTypes";

type RowOptions<TData> = {
  className?: string;
  onClick?: () => void;
  selected?: boolean;
};

type StandardTableProps<TData> = {
  data: TData[];
  columns: ETETableColumn<TData, any>[];
  sorting?: ETETableSorting;
  filtering?: ETETableFiltering<TData>;
  variant?: TableStyleVariant;
  renderToolbar?: (table: Table<TData>) => React.ReactNode;
  emptyState?: React.ReactNode;
  getRowOptions?: (row: Row<TData>) => RowOptions<TData>;
  tableLabel?: string;
};

export function StandardTable<TData>({
  data,
  columns,
  sorting,
  filtering,
  variant = "comfortable",
  renderToolbar,
  emptyState,
  getRowOptions,
  tableLabel,
}: StandardTableProps<TData>) {
  return (
    <ETETable data={data} columns={columns} sorting={sorting} filtering={filtering} variant={variant}>
      {({ headerGroups, rows, styles, table }) => {
        const classNames = getTableClassNames(styles);

        return (
          <div className="space-y-3">
            {renderToolbar ? <TableToolbar>{renderToolbar(table)}</TableToolbar> : null}

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className={classNames.table} aria-label={tableLabel}>
                {tableLabel ? <caption className="sr-only">{tableLabel}</caption> : null}
                <thead className={classNames.header}>
                  {headerGroups.map((headerGroup) => (
                    <tr key={headerGroup.id} className={classNames.headerRow}>
                      {headerGroup.headers
                        .filter((header) => !header.isPlaceholder)
                        .map((header) => {
                          const sortedState = header.column.getIsSorted();
                          const { columnDef } = header.column;
                          const sortable = header.column.getCanSort();

                          return (
                            <th key={header.id} colSpan={header.colSpan} className={classNames.headerCell} scope="col">
                              <button
                                type="button"
                                className={clsx("flex w-full items-center gap-2 text-left", {
                                  "cursor-default": !sortable,
                                  "text-indigo-700": Boolean(sortedState),
                                })}
                                onClick={() => header.column.toggleSorting(undefined, false)}
                                disabled={!sortable}
                                aria-label={
                                  sortedState === "asc"
                                    ? `${String(columnDef.header)} sorted ascending`
                                    : sortedState === "desc"
                                      ? `${String(columnDef.header)} sorted descending`
                                      : sortable
                                        ? `${String(columnDef.header)} sortable`
                                        : String(columnDef.header)
                                }
                              >
                                <span className="select-none">{flexRender(columnDef.header, header.getContext())}</span>
                                {sortable ? (
                                  <span aria-hidden="true" className="text-xs text-slate-500">
                                    {sortedState === "asc" ? "▲" : sortedState === "desc" ? "▼" : "⇅"}
                                  </span>
                                ) : null}
                              </button>
                            </th>
                          );
                        })}
                    </tr>
                  ))}
                </thead>
                <tbody className={classNames.body}>
                  {rows.length === 0 ? (
                    <tr className={getTableRowClasses(styles)}>
                      <td className={getTableCellClasses(styles)} colSpan={columns.length}>
                        {emptyState ?? (
                          <div className="py-6 text-center text-sm text-slate-500">No results found.</div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const options = getRowOptions?.(row);
                      return (
                        <tr
                          key={row.id}
                          className={clsx(
                            getTableRowClasses(styles, { hover: true, striped: true, selected: options?.selected }),
                            options?.className,
                          )}
                          data-state={options?.selected ? "selected" : undefined}
                          onClick={options?.onClick}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className={getTableCellClasses(styles)}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      }}
    </ETETable>
  );
}
