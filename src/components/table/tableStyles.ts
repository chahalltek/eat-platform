import clsx from "clsx";

export type TableStyleVariant = "comfortable" | "compact";

export type TableStyleSections = {
  table: string;
  header: string;
  headerRow: string;
  headerCell: string;
  body: string;
  row: string;
  cell: string;
};

export type TableStateClasses = {
  hover: string;
  selected: string;
  striped: string;
};

export type TableStylePreset = {
  variant: TableStyleVariant;
  density: "comfortable" | "compact";
  classes: TableStyleSections;
  states: TableStateClasses;
};

type RowStateConfig = {
  hover?: boolean;
  selected?: boolean;
  striped?: boolean;
};

const baseTable =
  "w-full border border-slate-200 rounded-lg overflow-hidden bg-white text-slate-900";
const headerRowBase = "divide-x divide-slate-200";
const bodyBase = "divide-y divide-slate-200";
const rowBase = "transition-colors";

const TABLE_STYLE_PRESETS: Record<TableStyleVariant, TableStylePreset> = {
  comfortable: {
    variant: "comfortable",
    density: "comfortable",
    classes: {
      table: clsx(baseTable, "text-sm"),
      header: "bg-slate-50 text-left",
      headerRow: headerRowBase,
      headerCell:
        "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600", 
      body: bodyBase,
      row: clsx(rowBase, "even:bg-slate-50/50"),
      cell: "px-4 py-3 text-sm text-slate-900 align-middle",
    },
    states: {
      hover: "hover:bg-slate-50",
      selected: "data-[state=selected]:bg-indigo-50 data-[state=selected]:text-indigo-900",
      striped: "odd:bg-white even:bg-slate-50/70",
    },
  },
  compact: {
    variant: "compact",
    density: "compact",
    classes: {
      table: clsx(baseTable, "text-sm"),
      header: "bg-slate-50 text-left",
      headerRow: headerRowBase,
      headerCell:
        "px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600", 
      body: bodyBase,
      row: clsx(rowBase, "even:bg-slate-50/50"),
      cell: "px-3 py-2 text-sm text-slate-900 align-middle",
    },
    states: {
      hover: "hover:bg-slate-50",
      selected: "data-[state=selected]:bg-indigo-50 data-[state=selected]:text-indigo-900",
      striped: "odd:bg-white even:bg-slate-50/70",
    },
  },
};

export function getTableStyles(variant: TableStyleVariant = "comfortable"): TableStylePreset {
  return TABLE_STYLE_PRESETS[variant];
}

export function getTableRowClasses(
  styles: TableStylePreset,
  state?: RowStateConfig,
): string {
  return clsx(
    styles.classes.row,
    state?.hover && styles.states.hover,
    state?.selected && styles.states.selected,
    state?.striped && styles.states.striped,
  );
}

export function getTableCellClasses(styles: TableStylePreset): string {
  return styles.classes.cell;
}

export function getTableClassNames(styles: TableStylePreset): TableStyleSections {
  return styles.classes;
}

export const TABLE_PRESETS = TABLE_STYLE_PRESETS;
