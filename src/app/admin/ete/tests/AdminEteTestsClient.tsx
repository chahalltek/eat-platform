"use client";

import {
  ArrowPathIcon,
  BeakerIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  FireIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState, useTransition } from "react";

import { cn } from "@/lib/utils";

interface QuickCommand {
  id: string;
  title: string;
  bulletPoints: string[];
  command: string;
}

interface TestCatalogItem {
  id: string;
  title: string;
  description: string;
  jobTemplate: string;
  discipline: string;
  command: string;
  ciCadence: string;
  ciStatus: string;
  nightlyStatus?: string;
  notes?: string;
}

interface AdminEteTestsClientProps {
  quickCommands: QuickCommand[];
  tests: TestCatalogItem[];
  isVercelLimited?: boolean;
  clipboard?: Pick<Clipboard, "writeText">;
}

function CopyButton({
  text,
  label,
  clipboard,
}: {
  text: string;
  label: string;
  clipboard?: Pick<Clipboard, "writeText">;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const activeClipboard = clipboard ?? navigator?.clipboard;
    if (!activeClipboard?.writeText) return;

    try {
      await activeClipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      console.error("Failed to copy command", error);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="relative inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-indigo-100 bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-white dark:border-indigo-900 dark:bg-indigo-950/70 dark:text-indigo-100"
    >
      {copied ? (
        <>
          <ClipboardDocumentCheckIcon className="h-4 w-4" />
          <span className="whitespace-nowrap">Copied</span>
        </>
      ) : (
        <>
          <ClipboardDocumentListIcon className="h-4 w-4" />
          <span className="whitespace-nowrap">{label}</span>
        </>
      )}
    </button>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition",
        active
          ? "border-indigo-300 bg-indigo-50 text-indigo-800 shadow-sm dark:border-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-100"
          : "border-zinc-200 bg-white text-zinc-700 hover:border-indigo-200 hover:text-indigo-700 dark:border-indigo-800 dark:bg-zinc-900 dark:text-zinc-200",
      )}
    >
      <FunnelIcon className="h-4 w-4" />
      {label}
    </button>
  );
}

export function AdminEteTestsClient({ quickCommands, tests, isVercelLimited = false, clipboard }: AdminEteTestsClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedJobTemplate, setSelectedJobTemplate] = useState<string | null>(null);
  const [selectedDiscipline, setSelectedDiscipline] = useState<string | null>(null);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(tests[0]?.id ?? null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [isRefreshing, startRefreshing] = useTransition();

  const jobTemplates = useMemo(() => Array.from(new Set(tests.map((test) => test.jobTemplate))), [tests]);
  const disciplines = useMemo(() => Array.from(new Set(tests.map((test) => test.discipline))), [tests]);

  const filteredTests = useMemo(() => {
    return tests.filter((test) => {
      const matchesSearch = [
        test.title,
        test.description,
        test.jobTemplate,
        test.discipline,
      ]
        .join("\n")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesTemplate = !selectedJobTemplate || test.jobTemplate === selectedJobTemplate;
      const matchesDiscipline = !selectedDiscipline || test.discipline === selectedDiscipline;

      return matchesSearch && matchesTemplate && matchesDiscipline;
    });
  }, [tests, searchTerm, selectedJobTemplate, selectedDiscipline]);

  useEffect(() => {
    setSelectedTestId(filteredTests[0]?.id ?? null);
  }, [filteredTests]);

  const selectedTest = filteredTests.find((test) => test.id === selectedTestId) ?? filteredTests[0] ?? null;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-4 rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-6 shadow-sm dark:border-indigo-900/60 dark:from-indigo-950/50 dark:via-zinc-950 dark:to-emerald-950/40">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Admin</p>
            <h1 className="text-3xl font-semibold text-zinc-900 sm:text-4xl dark:text-zinc-50">On-Demand Test Runner</h1>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Browse the key quality checks that run in CI and copy the exact commands engineers use when debugging.
            </p>
            {isVercelLimited ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100">
                <FireIcon className="h-4 w-4" />
                Catalog limited in Vercel — Can run locally for full parity
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3 text-sm">
            <button
              type="button"
              onClick={() => {
                startRefreshing(() => {
                  setTimeout(() => setLastRefreshedAt(new Date()), 300);
                });
              }}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-indigo-200 bg-white px-4 py-2 font-semibold text-indigo-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-indigo-50 hover:text-indigo-900 dark:border-indigo-800 dark:bg-zinc-900 dark:text-indigo-100"
            >
              <ArrowPathIcon className={cn("h-5 w-5", isRefreshing ? "animate-spin" : undefined)} />
              Refresh status
            </button>
            <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
              <BeakerIcon className="h-4 w-4" />
              Updated {lastRefreshedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {quickCommands.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-indigo-900 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{entry.title}</h3>
                  <ul className="ml-4 list-disc text-sm text-zinc-700 dark:text-zinc-300">
                    {entry.bulletPoints.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>
                <CopyButton text={entry.command} label="Copy command" clipboard={clipboard} />
              </div>
              <code className="block rounded-xl bg-zinc-900 px-4 py-3 text-xs text-emerald-100 shadow-inner">
                {entry.command}
              </code>
            </div>
          ))}
        </div>
      </header>

      <section className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            <ClipboardDocumentListIcon className="h-5 w-5" />
            Full test catalog
          </div>
          <div className="flex flex-wrap gap-2">
            {jobTemplates.map((template) => (
              <FilterPill
                key={template}
                label={template}
                active={selectedJobTemplate === template}
                onClick={() => setSelectedJobTemplate(selectedJobTemplate === template ? null : template)}
              />
            ))}
            {disciplines.map((discipline) => (
              <FilterPill
                key={discipline}
                label={discipline}
                active={selectedDiscipline === discipline}
                onClick={() => setSelectedDiscipline(selectedDiscipline === discipline ? null : discipline)}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <label className="relative flex items-center">
            <MagnifyingGlassIcon className="absolute left-3 h-5 w-5 text-zinc-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by title, description, job template, or discipline"
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 pl-10 text-sm text-zinc-900 shadow-inner placeholder:text-zinc-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-600"
            />
          </label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Results always select the first matching test. Filter buttons clear the previous selection instantly.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 shadow-inner dark:border-zinc-800 dark:bg-zinc-950">
            <h4 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-100">Tests</h4>
            <div className="flex flex-col gap-2">
              {filteredTests.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-3 py-6 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  No tests match the current filters.
                </div>
              ) : (
                filteredTests.map((test) => (
                  <button
                    key={test.id}
                    type="button"
                    onClick={() => setSelectedTestId(test.id)}
                    className={cn(
                      "flex w-full flex-col items-start gap-1 rounded-xl border px-3 py-3 text-left text-sm transition",
                      selectedTestId === test.id
                        ? "border-indigo-300 bg-white shadow-sm dark:border-indigo-700 dark:bg-indigo-900/30"
                        : "border-transparent bg-white hover:border-indigo-200 hover:shadow-sm dark:bg-zinc-900 dark:hover:border-indigo-800",
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{test.title}</span>
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-100">
                        {test.discipline}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">{test.jobTemplate}</p>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            {selectedTest ? (
              <div className="flex h-full flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-100">
                        {selectedTest.jobTemplate}
                      </span>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-100">
                        {selectedTest.discipline}
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{selectedTest.title}</h3>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">{selectedTest.description}</p>
                  </div>
                  <CopyButton text={selectedTest.command} label="Copy command" clipboard={clipboard} />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 shadow-inner dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
                    <p className="font-semibold">Command</p>
                    <p className="mt-1 break-words text-xs font-mono text-indigo-700 dark:text-indigo-200">{selectedTest.command}</p>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 shadow-inner dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
                    <p className="font-semibold">CI cadence</p>
                    <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{selectedTest.ciCadence}</p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-200">{selectedTest.ciStatus}</p>
                    {selectedTest.nightlyStatus ? (
                      <p className="text-xs text-indigo-700 dark:text-indigo-200">Nightly: {selectedTest.nightlyStatus}</p>
                    ) : null}
                    {isVercelLimited ? (
                      <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900 dark:bg-amber-900/50 dark:text-amber-50">
                        <FireIcon className="h-4 w-4" /> Catalog limited in Vercel
                      </p>
                    ) : null}
                  </div>
                </div>

                {selectedTest.notes ? (
                  <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                    {selectedTest.notes}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                Select a test from the list to view details.
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
