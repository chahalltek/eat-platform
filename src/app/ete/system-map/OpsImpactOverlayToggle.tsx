'use client';

import clsx from "clsx";

import { useOpsImpactOverlay } from "./OpsImpactOverlayContext";

export function OpsImpactOverlayToggle() {
  const { enabled, setEnabled } = useOpsImpactOverlay();

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <label className="inline-flex cursor-pointer items-center gap-3 rounded-full bg-white/80 px-3 py-2 text-sm font-semibold text-indigo-900 ring-1 ring-indigo-100 transition hover:-translate-y-0.5 hover:shadow-sm dark:bg-zinc-900/70 dark:text-indigo-100 dark:ring-indigo-800/60">
        <span
          className={clsx(
            "relative inline-flex h-5 w-10 items-center rounded-full border border-indigo-200 bg-indigo-100 transition-all dark:border-indigo-800/70 dark:bg-indigo-900/70",
            enabled ? "border-indigo-400 bg-indigo-200 dark:border-indigo-500 dark:bg-indigo-800" : "",
          )}
        >
          <span
            className={clsx(
              "absolute left-0.5 h-4 w-4 rounded-full bg-white shadow transition-all dark:bg-zinc-100",
              enabled ? "translate-x-5 bg-indigo-600 shadow-indigo-200 dark:bg-indigo-400 dark:shadow-indigo-900" : "",
            )}
            aria-hidden
          />
          <input
            type="checkbox"
            className="sr-only"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            aria-label="Show Ops Impact Overlay"
          />
        </span>
        <span className="text-[13px] uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-200">Show Ops Impact Overlay</span>
      </label>
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        Toggle to reveal operational impact for each node without changing the base blueprint.
      </p>
    </div>
  );
}
