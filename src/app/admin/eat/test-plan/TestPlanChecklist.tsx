"use client";

import clsx from "clsx";
import { useMemo, useState } from "react";

import {
  TEST_PLAN_ITEMS,
  TEST_PLAN_STATUS_OPTIONS,
  type TestPlanItem,
  type TestPlanSection,
  type TestPlanStatusValue,
} from "@/lib/eat/testPlanRegistry";

export type TestPlanChecklistProps = {
  sections: { section: TestPlanSection; items: TestPlanItem[] }[];
  initialStatuses: Record<
    string,
    { status: TestPlanStatusValue; note: string | null; updatedBy: string; updatedAt: string }
  >;
};

type ItemState = {
  status: TestPlanStatusValue;
  note: string;
  updatedBy?: string;
  updatedAt?: string;
};

const STATUS_LABELS: Record<TestPlanStatusValue, string> = {
  not_run: "Not run",
  pass: "Pass",
  fail: "Fail",
  blocked: "Blocked",
};

const STATUS_COLORS: Record<TestPlanStatusValue, string> = {
  not_run: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  pass: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  fail: "bg-rose-50 text-rose-800 ring-rose-200",
  blocked: "bg-amber-50 text-amber-800 ring-amber-200",
};

export function TestPlanChecklist({ sections, initialStatuses }: TestPlanChecklistProps) {
  const [statusFilter, setStatusFilter] = useState<"all" | TestPlanStatusValue>("all");
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
    () => Object.fromEntries(sections.map(({ section }) => [section.id, true])) as Record<string, boolean>,
  );

  const [itemStates, setItemStates] = useState<Record<string, ItemState>>(() => {
    const defaults: Record<string, ItemState> = {};

    TEST_PLAN_ITEMS.forEach((item) => {
      const existing = initialStatuses[item.id];
      defaults[item.id] = {
        status: existing?.status ?? "not_run",
        note: existing?.note ?? "",
        updatedAt: existing?.updatedAt,
        updatedBy: existing?.updatedBy,
      };
    });

    return defaults;
  });

  const summary = useMemo(() => {
    const total = TEST_PLAN_ITEMS.length;
    const completed = TEST_PLAN_ITEMS.filter((item) => (itemStates[item.id]?.status ?? "not_run") !== "not_run").length;
    const criticalRemaining = TEST_PLAN_ITEMS.filter((item) =>
      item.isCritical ? (itemStates[item.id]?.status ?? "not_run") !== "pass" : false,
    ).length;

    return { total, completed, criticalRemaining };
  }, [itemStates]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const visibleItems = (items: TestPlanItem[]) =>
    items.filter((item) => {
      const state = itemStates[item.id] ?? { status: "not_run", note: "" };

      if (criticalOnly && !item.isCritical) {
        return false;
      }

      if (statusFilter !== "all" && state.status !== statusFilter) {
        return false;
      }

      return true;
    });

  async function persistItem(itemId: string, nextState: ItemState) {
    setSavingItemId(itemId);
    setFeedback(null);

    try {
      const response = await fetch("/api/eat/test-plan/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, status: nextState.status, note: nextState.note }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? "Unable to save");
      }

      const saved = await response.json();

      setItemStates((prev) => ({
        ...prev,
        [itemId]: {
          status: saved.status,
          note: saved.note ?? "",
          updatedAt: saved.updatedAt,
          updatedBy: saved.updatedBy,
        },
      }));
      setFeedback("Saved");
    } catch (error) {
      console.error(error);
      setFeedback("Unable to save changes. Please try again.");
    } finally {
      setSavingItemId(null);
    }
  }

  const handleStatusChange = (itemId: string, status: TestPlanStatusValue) => {
    setItemStates((prev) => {
      const current = prev[itemId] ?? { status: "not_run", note: "" };
      const nextState = { ...current, status };
      void persistItem(itemId, nextState);
      return { ...prev, [itemId]: nextState };
    });
  };

  const handleNoteChange = (itemId: string, note: string) => {
    setItemStates((prev) => ({ ...prev, [itemId]: { ...(prev[itemId] ?? { status: "not_run", note: "" }), note } }));
  };

  const handleNoteBlur = (itemId: string) => {
    const current = itemStates[itemId] ?? { status: "not_run", note: "" };
    void persistItem(itemId, current);
  };

  const statusFilters: { value: "all" | TestPlanStatusValue; label: string }[] = [
    { value: "all", label: "All" },
    { value: "not_run", label: "Not started" },
    { value: "pass", label: "Pass" },
    { value: "fail", label: "Fail" },
    { value: "blocked", label: "Blocked" },
  ];

  const hasVisibleItems = sections.some(({ items, section }) => section.readOnly || visibleItems(items).length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-indigo-100 bg-white/80 p-4 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Summary</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Track progress across the MVP test charter and detailed areas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <div className="rounded-full bg-indigo-50 px-4 py-2 font-semibold text-indigo-800 ring-1 ring-indigo-100 dark:bg-indigo-900/60 dark:text-indigo-100 dark:ring-indigo-800">
              {summary.completed}/{summary.total} items touched
            </div>
            <div className="rounded-full bg-amber-50 px-4 py-2 font-semibold text-amber-800 ring-1 ring-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:ring-amber-800">
              {summary.criticalRemaining} critical items remaining
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((filter) => (
              <button
                key={filter.value}
                className={clsx(
                  "rounded-full px-3 py-1 text-sm font-semibold ring-1 transition",
                  statusFilter === filter.value
                    ? "bg-indigo-600 text-white ring-indigo-600"
                    : "bg-white text-indigo-700 ring-indigo-100 hover:bg-indigo-50 dark:bg-zinc-900 dark:text-indigo-200 dark:ring-indigo-800/60"
                )}
                onClick={() => setStatusFilter(filter.value)}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>

          <label className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-800 dark:text-indigo-100">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-indigo-200 text-indigo-600 focus:ring-indigo-500"
              checked={criticalOnly}
              onChange={(event) => setCriticalOnly(event.target.checked)}
            />
            Show only critical (MVP charter)
          </label>
        </div>

        {feedback ? <p className="text-sm text-indigo-700 dark:text-indigo-200">{feedback}</p> : null}
      </div>

      {!hasVisibleItems ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/70 p-6 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-300">
          No checklist items match the current filters.
        </div>
      ) : null}

      {sections.map(({ section, items }) => {
        const sectionItems = visibleItems(items);
        if (!section.readOnly && sectionItems.length === 0) {
          return null;
        }

        const isExpanded = expandedSections[section.id];

        return (
          <div
            key={section.id}
            className="overflow-hidden rounded-2xl border border-indigo-100 bg-white/90 shadow-sm dark:border-indigo-900/60 dark:bg-zinc-900/70"
          >
            <button
              type="button"
              onClick={() => toggleSection(section.id)}
              className="flex w-full items-center justify-between gap-3 border-b border-indigo-50 bg-indigo-50/60 px-4 py-3 text-left hover:bg-indigo-100/60 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50"
            >
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">{section.id}</p>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{section.title}</h2>
                {section.subtitle ? <p className="text-sm text-zinc-600 dark:text-zinc-400">{section.subtitle}</p> : null}
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-100 dark:ring-indigo-800/60">
                {isExpanded ? "Collapse" : "Expand"}
              </span>
            </button>

            {isExpanded ? (
              <div className="divide-y divide-indigo-50 dark:divide-indigo-900/50">
                {section.readOnly ? (
                  <div className="space-y-2 p-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
                    {section.body?.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                ) : (
                  sectionItems.map((item) => {
                    const state = itemStates[item.id] ?? { status: "not_run", note: "" };
                    const isSaving = savingItemId === item.id;

                    return (
                      <div key={item.id} className="p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {item.isCritical ? (
                                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:ring-amber-800/60">
                                  Critical
                                </span>
                              ) : null}
                              <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{item.label}</p>
                            </div>
                            <p className="text-sm text-zinc-600 dark:text-zinc-300">{item.description}</p>
                            {state.updatedAt ? (
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                Last updated {new Date(state.updatedAt).toLocaleString()} by {state.updatedBy ?? "admin"}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 md:justify-end">
                            {TEST_PLAN_STATUS_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => handleStatusChange(item.id, option.value)}
                                className={clsx(
                                  "rounded-full px-3 py-1 text-sm font-semibold ring-1 transition",
                                  state.status === option.value
                                    ? "bg-indigo-600 text-white ring-indigo-600"
                                    : "bg-white text-indigo-700 ring-indigo-100 hover:bg-indigo-50 dark:bg-zinc-900 dark:text-indigo-200 dark:ring-indigo-800/60",
                                )}
                                disabled={isSaving}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="mt-3 grid gap-2">
                          <div className="inline-flex items-center gap-2 self-start rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ring-1 ring-zinc-200 dark:ring-indigo-900/60">
                            <span className={clsx("h-2 w-2 rounded-full", STATUS_COLORS[state.status].split(" ")[0])} />
                            {STATUS_LABELS[state.status]}
                          </div>
                          <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-100" htmlFor={`${item.id}-note`}>
                            Notes
                          </label>
                          <textarea
                            id={`${item.id}-note`}
                            className="min-h-[96px] w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-50 dark:border-indigo-900/60 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/40"
                            placeholder="Capture findings, repro steps, or blockers"
                            value={state.note}
                            onChange={(event) => handleNoteChange(item.id, event.target.value)}
                            onBlur={() => handleNoteBlur(item.id)}
                            disabled={isSaving}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
