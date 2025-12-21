"use client";

import { BoltIcon, ChatBubbleLeftEllipsisIcon, ClipboardDocumentListIcon, CommandLineIcon, FunnelIcon, MagnifyingGlassIcon, ShieldCheckIcon, TagIcon } from "@heroicons/react/24/outline";
import { useMemo, useState, type KeyboardEvent } from "react";

import { CopyButton } from "@/components/CopyButton";
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

export function EteTestRunnerClient({
  catalog,
  tenantId,
  isVercelLimited,
}: {
  catalog: TestCatalogItem[];
  tenantId: string;
  isVercelLimited: boolean;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const clipboard = useMemo(() => (typeof navigator !== "undefined" ? navigator.clipboard : undefined), []);

  const tags = useMemo(() => Array.from(new Set(catalog.flatMap((item) => item.tags))), [catalog]);
  const filteredCatalog = useMemo(() => {
    const tagFiltered = activeTag ? catalog.filter((item) => item.tags.includes(activeTag)) : catalog;
    const term = searchTerm.trim().toLowerCase();

    if (!term) {
      return tagFiltered;
    }

    return tagFiltered.filter((item) => {
      const haystack = `${item.title} ${item.description} ${item.tags.join(" ")}`.toLowerCase();

      return haystack.includes(term);
    });
  }, [activeTag, catalog, searchTerm]);

  const hasFilters = Boolean(activeTag || searchTerm.trim());

  async function copyText(value: string) {
    if (!clipboard?.writeText) return;

    try {
      await clipboard.writeText(value);
    } catch (error) {
      console.error("Failed to copy", error);
    }
  }

  function copyAreaProps(value: string) {
    return {
      role: "button",
      tabIndex: 0,
      onClick: () => void copyText(value),
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          void copyText(value);
        }
      },
      title: "Copy to clipboard",
    };
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-4 rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-6 shadow-sm dark:border-indigo-900/60 dark:from-indigo-950/50 dark:via-zinc-950 dark:to-emerald-950/40">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Tenant</p>
            <h1 className="text-3xl font-semibold text-zinc-900 sm:text-4xl dark:text-zinc-50">ETE Test Runner</h1>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Copy-ready commands for tenant {tenantId}. The catalog mirrors CI so you can paste locally or into pipelines
              without triggering a server-side run.
            </p>
            {isVercelLimited ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100">
                <BoltIcon className="h-4 w-4" />
                Catalog only (execution disabled in this environment)
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {QUICK_COMMANDS.map((entry) => (
            <div
              key={entry.id}
              className="relative flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-indigo-900 dark:bg-zinc-900"
              {...copyAreaProps(entry.command)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{entry.title}</h3>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">{entry.description}</p>
                </div>
                <CopyButton text={entry.command} label="Copy command" className="absolute right-4 top-4" stopPropagation />
              </div>
              <code className="block rounded-xl bg-zinc-900 px-4 py-3 text-xs text-emerald-100 shadow-inner">{entry.command}</code>
            </div>
          ))}
        </div>
      </header>

      <section className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              <ClipboardDocumentListIcon className="h-5 w-5" />
              Catalog checks
              <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-100">
                {filteredCatalog.length}
              </span>
            </div>

            <div className="relative w-full md:max-w-sm">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-zinc-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by title, description, or tag"
                className="w-full rounded-full border border-zinc-200 bg-zinc-50 py-2 pl-10 pr-4 text-sm text-zinc-800 shadow-inner transition focus:border-indigo-300 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              <FunnelIcon className="h-4 w-4" />
              Refine by tag
            </span>
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  activeTag === tag
                    ? "border-indigo-300 bg-indigo-50 text-indigo-800 shadow-sm dark:border-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-100"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-indigo-200 hover:text-indigo-700 dark:border-indigo-800 dark:bg-zinc-900 dark:text-zinc-200",
                )}
              >
                {tag}
              </button>
            ))}

            {hasFilters ? (
              <button
                type="button"
                onClick={() => {
                  setActiveTag(null);
                  setSearchTerm("");
                }}
                className="inline-flex items-center gap-1 rounded-full border border-transparent px-2.5 py-1 text-xs font-semibold text-indigo-700 transition hover:border-indigo-200 hover:bg-indigo-50 dark:text-indigo-200 dark:hover:border-indigo-800 dark:hover:bg-indigo-950"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>

        {filteredCatalog.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200">
            <p className="font-semibold text-zinc-800 dark:text-zinc-100">No checks match your filters.</p>
            <p>Try clearing filters or adjusting your search to see the full catalog again.</p>
            <button
              type="button"
              onClick={() => {
                setActiveTag(null);
                setSearchTerm("");
              }}
              className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-900 dark:text-indigo-100"
            >
              <ClipboardDocumentListIcon className="h-4 w-4" />
              Reset catalog view
            </button>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredCatalog.map((item) => (
              <article
                key={item.id}
                className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Check</p>
                    <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{item.title}</h2>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">{item.description}</p>
                  </div>
                  {item.blockedInVercel ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-50">
                      <ShieldCheckIcon className="h-4 w-4" />
                      Local only
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-100"
                    >
                      <TagIcon className="h-4 w-4" />
                      {tag}
                    </span>
                  ))}
                </div>

                <div className={cn("grid gap-3", item.slackSnippet ? "md:grid-cols-3" : "md:grid-cols-2")}>
                  <div
                    className="relative rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800 shadow-inner transition hover:-translate-y-0.5 hover:border-indigo-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                    {...copyAreaProps(item.localCommand)}
                  >
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300">
                      <div className="flex items-center gap-2">
                        <CommandLineIcon className="h-4 w-4" />
                        Local command
                      </div>
                      <CopyButton text={item.localCommand} label="Copy local" className="absolute right-3 top-3" stopPropagation />
                    </div>
                    <code className="block whitespace-pre-wrap font-mono text-sm leading-relaxed text-indigo-700 dark:text-indigo-200">{item.localCommand}</code>
                  </div>

                  <div
                    className="relative rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800 shadow-inner transition hover:-translate-y-0.5 hover:border-indigo-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                    {...(item.ciStep ? copyAreaProps(item.ciStep) : {})}
                  >
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300">
                      <div className="flex items-center gap-2">
                        <ShieldCheckIcon className="h-4 w-4" />
                        CI snippet
                      </div>
                      {item.ciStep ? (
                        <CopyButton text={item.ciStep} label="Copy GH Actions" className="absolute right-3 top-3" stopPropagation />
                      ) : null}
                    </div>
                    {item.ciStep ? (
                      <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-zinc-800 dark:text-zinc-100">{item.ciStep}</pre>
                    ) : (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Not yet published to CI.</p>
                    )}
                  </div>

                  {item.slackSnippet ? (
                    <div
                      className="relative rounded-xl border border-indigo-100 bg-zinc-50 p-4 text-sm text-zinc-800 shadow-inner transition hover:-translate-y-0.5 hover:border-indigo-200 dark:border-indigo-900 dark:bg-zinc-900 dark:text-zinc-100"
                      {...copyAreaProps(item.slackSnippet)}
                    >
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300">
                        <div className="flex items-center gap-2">
                          <ChatBubbleLeftEllipsisIcon className="h-4 w-4" />
                          IM-ready snippet
                        </div>
                        <CopyButton text={item.slackSnippet} label="Copy IM snippet" className="absolute right-3 top-3" stopPropagation />
                      </div>
                      <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-zinc-800 dark:text-zinc-100">{item.slackSnippet}</pre>
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-3 text-xs font-semibold text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-100">
                  <BoltIcon className="h-4 w-4" />
                  {isVercelLimited ? "Catalog only in this environment — copy and paste into local shells or CI." : "Copy and paste; no commands are executed from this page."}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
