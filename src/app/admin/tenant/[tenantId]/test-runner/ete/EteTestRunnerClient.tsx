"use client";

import {
  BoltIcon,
  ChatBubbleLeftEllipsisIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  CommandLineIcon,
  FunnelIcon,
  ShieldCheckIcon,
  TagIcon,
} from "@heroicons/react/24/outline";
import { useMemo, useState } from "react";

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
      className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-sm font-semibold text-indigo-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-100"
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

export function EteTestRunnerClient({
  catalog,
  tenantId,
  isVercelLimited,
}: {
  catalog: TestCatalogItem[];
  tenantId: string;
  isVercelLimited: boolean;
}) {
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const tags = useMemo(() => Array.from(new Set(catalog.flatMap((item) => item.tags))), [catalog]);
  const filteredCatalog = useMemo(
    () => (activeTag ? catalog.filter((item) => item.tags.includes(activeTag)) : catalog),
    [activeTag, catalog],
  );

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
              className="flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-indigo-900 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{entry.title}</h3>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">{entry.description}</p>
                </div>
                <CopyButton text={entry.command} label="Copy command" />
              </div>
              <code className="block rounded-xl bg-zinc-900 px-4 py-3 text-xs text-emerald-100 shadow-inner">{entry.command}</code>
            </div>
          ))}
        </div>
      </header>

      <section className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            <ClipboardDocumentListIcon className="h-5 w-5" />
            Catalog checks
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition",
                  activeTag === tag
                    ? "border-indigo-300 bg-indigo-50 text-indigo-800 shadow-sm dark:border-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-100"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-indigo-200 hover:text-indigo-700 dark:border-indigo-800 dark:bg-zinc-900 dark:text-zinc-200",
                )}
              >
                <FunnelIcon className="h-4 w-4" />
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {filteredCatalog.map((item) => (
            <article
              key={item.id}
              className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 shadow-sm transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
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
                <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-800 shadow-inner dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
                  <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300">
                    <div className="flex items-center gap-2">
                      <CommandLineIcon className="h-4 w-4" />
                      Local command
                    </div>
                    <CopyButton text={item.localCommand} label="Copy local" />
                  </div>
                  <code className="block whitespace-pre-wrap font-mono text-sm leading-relaxed text-indigo-700 dark:text-indigo-200">{item.localCommand}</code>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-800 shadow-inner dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
                  <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300">
                    <div className="flex items-center gap-2">
                      <ShieldCheckIcon className="h-4 w-4" />
                      CI snippet
                    </div>
                    {item.ciStep ? <CopyButton text={item.ciStep} label="Copy GH Actions" /> : null}
                  </div>
                  {item.ciStep ? (
                    <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-zinc-800 dark:text-zinc-100">{item.ciStep}</pre>
                  ) : (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Not yet published to CI.</p>
                  )}
                </div>

                {item.slackSnippet ? (
                  <div className="rounded-xl border border-indigo-100 bg-white p-4 text-sm text-zinc-800 shadow-inner dark:border-indigo-900 dark:bg-zinc-900 dark:text-zinc-100">
                    <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300">
                      <div className="flex items-center gap-2">
                        <ChatBubbleLeftEllipsisIcon className="h-4 w-4" />
                        Slack-ready snippet
                      </div>
                      <CopyButton text={item.slackSnippet} label="Copy Slack snippet" />
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
      </section>
    </main>
  );
}
