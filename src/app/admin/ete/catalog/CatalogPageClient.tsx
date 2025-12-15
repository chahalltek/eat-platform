"use client";

import { useEffect, useMemo, useState } from "react";

type CatalogItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  quickCommands?: string[];
  snippet?: string;
};

type Clipboard = {
  writeText?: (value: string) => Promise<void> | void;
};

const QUICK_FILTERS = [
  { label: "All", value: "" },
  { label: "Data", value: "data" },
  { label: "Runtime", value: "runtime" },
  { label: "Scoring", value: "scoring" },
];

function normalizeFilter(value: string) {
  return value.trim().toLowerCase();
}

export function CatalogPageClient({ clipboard }: { clipboard?: Clipboard } = {}) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchCatalog = async () => {
      try {
        const response = await fetch("/api/admin/ete/catalog");
        if (!response.ok) {
          throw new Error("Unable to load catalog");
        }
        const data = await response.json();
        const loaded: CatalogItem[] = data.items ?? [];

        if (active) {
          setItems(loaded);
          setSelectedId((prev) => prev ?? loaded[0]?.id ?? null);
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load catalog");
      }
    };

    fetchCatalog();

    return () => {
      active = false;
    };
  }, []);

  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId]);
  const normalizedFilter = normalizeFilter(filter);

  const filteredItems = useMemo(() => {
    if (!normalizedFilter) return items;

    return items.filter((item) => {
      return (
        normalizeFilter(item.name).includes(normalizedFilter) || normalizeFilter(item.category).includes(normalizedFilter)
      );
    });
  }, [items, normalizedFilter]);

  async function handleCopy() {
    const activeClipboard = clipboard ?? navigator?.clipboard;
    if (!selected?.snippet || !activeClipboard?.writeText) return;
    await activeClipboard.writeText(selected.snippet);
  }

  return (
    <div className="flex flex-col gap-6 rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm dark:border-indigo-900/60 dark:bg-zinc-950/60">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Admin · Catalog</p>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">ETE knowledge catalog</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Search the runbook for troubleshooting commands, data sources, and playbook snippets.
        </p>
      </header>

      <div className="flex flex-wrap gap-2" aria-label="Quick commands">
        {QUICK_FILTERS.map((quick) => (
          <button
            key={quick.label}
            className={`rounded-full px-3 py-2 text-sm font-semibold ring-1 transition ${
              quick.value === normalizedFilter
                ? "bg-indigo-600 text-white ring-indigo-500"
                : "bg-white text-indigo-800 ring-indigo-100 hover:bg-indigo-50"
            }`}
            onClick={() => setFilter(quick.value)}
          >
            {quick.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-indigo-100 bg-white/70 p-4 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/60">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex flex-1 items-center gap-2">
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Filter</span>
            <input
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Search catalog"
              className="w-full rounded-full border border-indigo-100 px-4 py-2 text-sm focus:border-indigo-300 focus:outline-none dark:border-indigo-800 dark:bg-zinc-950"
            />
          </label>
          {error ? (
            <span className="text-sm font-semibold text-rose-600" role="alert">
              {error}
            </span>
          ) : (
            <span className="text-sm text-zinc-500" aria-live="polite">
              Showing {filteredItems.length} item{filteredItems.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-[2fr,3fr]">
          <div className="space-y-2" role="list" aria-label="Catalog items">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                className={`flex w-full flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition ${
                  item.id === selectedId
                    ? "border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-700 dark:bg-indigo-900/40"
                    : "border-indigo-100 bg-white text-zinc-800 hover:border-indigo-200 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-zinc-950 dark:text-zinc-100"
                }`}
                onClick={() => setSelectedId(item.id)}
                role="listitem"
              >
                <span className="text-sm font-semibold">{item.name}</span>
                <span className="text-xs text-zinc-500">{item.category}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-indigo-100 bg-white p-4 shadow-sm dark:border-indigo-800 dark:bg-zinc-950">
            {selected ? (
              <>
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Selected</p>
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{selected.name}</h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">{selected.description}</p>
                </div>
                {selected.quickCommands?.length ? (
                  <div className="space-y-2" aria-label="Item quick commands">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Quick commands</p>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-200">
                      {selected.quickCommands.map((command) => (
                        <li key={command}>{command}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex w-fit items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                >
                  Copy snippet
                </button>
              </>
            ) : (
              <p className="text-sm text-zinc-500">Select a catalog item to view details.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
