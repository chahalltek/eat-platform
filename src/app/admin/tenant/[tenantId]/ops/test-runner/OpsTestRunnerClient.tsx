"use client";

import {
  BoltIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  CommandLineIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  TagIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";

import type { TestCatalogItem } from "@/lib/testing/testCatalog";
import { cn } from "@/lib/utils";

type QuickCommand = {
  id: string;
  title: string;
  description: string;
  command: string;
};

const QUICK_COMMANDS: QuickCommand[] = [
  {
    id: "npm-test",
    title: "Unit sweep (fast)",
    description: "Run the local Vitest suite for quick iteration before opening a PR.",
    command: "npm run test",
  },
  {
    id: "npm-test-coverage",
    title: "Unit coverage (parity)",
    description: "Match CI by capturing coverage locally when validating fixes.",
    command: "npm run test -- --coverage",
  },
  {
    id: "ete-auth",
    title: "ETE auth harness",
    description: "Validates tenant scoping and the admin listing endpoint auth flows.",
    command: "npm run ete:auth",
  },
  {
    id: "ete-catalog",
    title: "ETE catalog export",
    description: "Generate the curated catalog registry that CI consumes for smoke jobs.",
    command: "npm run ete:catalog",
  },
];

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      console.error("Failed to copy", error);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-sm font-semibold text-indigo-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:text-indigo-900"
    >
      {copied ? (
        <>
          <ClipboardDocumentCheckIcon className="h-5 w-5" />
          Copied
        </>
      ) : (
        <>
          <ClipboardDocumentListIcon className="h-5 w-5" />
          {label}
        </>
      )}
    </button>
  );
}

export function OpsTestRunnerClient({ catalog }: { catalog: TestCatalogItem[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeId, setActiveId] = useState<string | null>(catalog[0]?.id ?? null);

  const filteredCatalog = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    if (!term) {
      return catalog;
    }

    return catalog.filter((item) => {
      const haystack = `${item.title} ${item.description} ${item.tags.join(" ")}`.toLowerCase();

      return haystack.includes(term);
    });
  }, [catalog, searchTerm]);

  useEffect(() => {
    if (!filteredCatalog.length) {
      setActiveId(null);
      return;
    }

    if (!activeId || !filteredCatalog.some((item) => item.id === activeId)) {
      setActiveId(filteredCatalog[0].id);
    }
  }, [activeId, filteredCatalog]);

  const activeItem = filteredCatalog.find((item) => item.id === activeId) ?? filteredCatalog[0] ?? null;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-4 rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Ops</p>
            <h1 className="text-3xl font-semibold text-zinc-900 sm:text-4xl">ETE Ops Test Runner</h1>
            <p className="text-sm text-zinc-700">
              Copy-ready commands and CI snippets for the shared ETE smoke catalog. Paste into your terminal or pipeline
              workflows without running jobs from the admin UI.
            </p>
          </div>
          <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-indigo-800 shadow-sm">
            {filteredCatalog.length} checks listed
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {QUICK_COMMANDS.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-white/70 p-5 shadow-sm backdrop-blur"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-semibold text-zinc-900">{entry.title}</h3>
                  <p className="text-sm text-zinc-700">{entry.description}</p>
                </div>
                <CopyButton text={entry.command} label="Copy command" />
              </div>
              <code className="block rounded-xl bg-zinc-900 px-4 py-3 text-xs text-emerald-100 shadow-inner">{entry.command}</code>
            </div>
          ))}
        </div>
      </header>

      <section className="grid gap-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm lg:grid-cols-[1.1fr_1.6fr]">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
              <ClipboardDocumentListIcon className="h-5 w-5" />
              Catalog checks
            </div>
            <div className="relative w-full">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-zinc-400" />
              <input
                type="search"
                placeholder="Search by title, description, or tag"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-full border border-zinc-200 bg-zinc-50 py-2 pl-10 pr-4 text-sm text-zinc-800 shadow-inner focus:border-indigo-300 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
            <FunnelIcon className="h-4 w-4" />
            Filter with search to narrow down checks by keywords or tags.
          </div>

          <div className="flex flex-col divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200">
            {filteredCatalog.length === 0 ? (
              <p className="p-4 text-sm text-zinc-600">No checks match your search.</p>
            ) : (
              filteredCatalog.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveId(item.id)}
                  className={cn(
                    "flex flex-col gap-1 p-4 text-left transition hover:bg-indigo-50",
                    activeId === item.id ? "bg-indigo-50" : "bg-white",
                  )}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">{item.tags.join(" • ")}</p>
                  <h3 className="text-base font-semibold text-zinc-900">{item.title}</h3>
                  <p className="text-sm text-zinc-600 line-clamp-2">{item.description}</p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 shadow-inner">
          {!activeItem ? (
            <p className="text-sm text-zinc-600">Select a check to view details.</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Check details</p>
                  <h2 className="text-xl font-semibold text-zinc-900">{activeItem.title}</h2>
                </div>
                {activeItem.blockedInVercel ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                    <ShieldCheckIcon className="h-4 w-4" />
                    Local only
                  </span>
                ) : null}
              </div>

              <p className="text-sm text-zinc-700">{activeItem.description}</p>

              <div className="flex flex-wrap gap-2">
                {activeItem.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800"
                  >
                    <TagIcon className="h-4 w-4" />
                    {tag}
                  </span>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-800 shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600">
                    <div className="flex items-center gap-2">
                      <CommandLineIcon className="h-4 w-4" />
                      Local command
                    </div>
                    <CopyButton text={activeItem.localCommand} label="Copy" />
                  </div>
                  <code className="block whitespace-pre-wrap font-mono text-sm leading-relaxed text-indigo-700">{activeItem.localCommand}</code>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-800 shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600">
                    <div className="flex items-center gap-2">
                      <ShieldCheckIcon className="h-4 w-4" />
                      CI snippet
                    </div>
                    {activeItem.ciStep ? <CopyButton text={activeItem.ciStep} label="Copy" /> : null}
                  </div>
                  {activeItem.ciStep ? (
                    <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-zinc-800">{activeItem.ciStep}</pre>
                  ) : (
                    <p className="text-xs text-zinc-500">Not yet published to CI.</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-3 text-xs font-semibold text-indigo-900">
                <BoltIcon className="h-4 w-4" />
                Copy and paste; no commands are executed from this page.
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
