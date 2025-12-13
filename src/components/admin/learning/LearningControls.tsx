"use client";

import { useMemo, useState } from "react";

import { PauseCircleIcon, PlayCircleIcon } from "@heroicons/react/24/outline";

export function LearningControls({
  initialPaused,
  pausedReason,
}: {
  initialPaused: boolean;
  pausedReason: string;
}) {
  const [isPaused, setIsPaused] = useState(initialPaused);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const statusText = useMemo(() => {
    if (isPaused) {
      return pausedReason || "Learning paused by admin";
    }

    return "Learning is active and collecting signals.";
  }, [isPaused, pausedReason]);

  const handlePause = () => {
    setIsPaused(true);
    setLastUpdated(new Date());
  };

  const handleResume = () => {
    setIsPaused(false);
    setLastUpdated(new Date());
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Controls</p>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Pause / resume learning</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Soft toggle updates state immediately without auto-applying changes.</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            isPaused
              ? "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-50"
              : "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-50"
          }`}
        >
          {isPaused ? "Paused" : "Active"}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-3 text-sm text-zinc-700 dark:text-zinc-200">
        <p>{statusText}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Last updated {lastUpdated.toLocaleString()}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handlePause}
          className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <PauseCircleIcon className="h-5 w-5" aria-hidden />
          Pause learning
        </button>
        <button
          type="button"
          onClick={handleResume}
          className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
        >
          <PlayCircleIcon className="h-5 w-5" aria-hidden />
          Resume learning
        </button>
      </div>

      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        Actions are instantaneous for this workspace and do not deploy configuration automatically.
      </p>
    </div>
  );
}
