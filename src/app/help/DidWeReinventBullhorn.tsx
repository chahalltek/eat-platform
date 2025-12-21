"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { CheckIcon, ClipboardIcon } from "@heroicons/react/24/outline";

import { buildHelpEntryFullText, eteVsBullhornContent, type HelpEntry } from "@/content/help/eteVsBullhorn";

type DidWeReinventBullhornProps = {
  entry?: HelpEntry;
  anchorId?: string;
  additionalContent?: ReactNode;
};

export function DidWeReinventBullhorn({ entry = eteVsBullhornContent, anchorId, additionalContent }: DidWeReinventBullhornProps) {
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">("idle");

  const isDecisionSop = entry.key === "decision_sop";

  const fullCopy = useMemo(() => buildHelpEntryFullText(entry), [entry]);

  const handleCopy = useCallback(async () => {
    if (copyState === "success") return;
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error("Clipboard API not available");
      }

      await navigator.clipboard.writeText(fullCopy);
      setCopyState("success");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch (error) {
      console.error("Failed to copy help entry", error);
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 2500);
    }
  }, [copyState, fullCopy]);

  return (
    <section
      id={anchorId}
      className="space-y-6 rounded-3xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
            {entry.eyebrow ?? "FAQ"}
          </p>
          <h2 className="text-3xl font-semibold text-zinc-900 sm:text-4xl dark:text-zinc-50">{entry.title}</h2>
          {entry.description ? (
            <p className="max-w-3xl text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{entry.description}</p>
          ) : null}
        </div>
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 ring-1 ring-indigo-100 transition hover:-translate-y-0.5 hover:bg-indigo-100 hover:text-indigo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-100 dark:ring-indigo-800/60 dark:hover:bg-indigo-900/60 dark:hover:text-indigo-50"
          >
            {copyState === "success" ? (
              <CheckIcon className="h-4 w-4" aria-hidden />
            ) : (
              <ClipboardIcon className="h-4 w-4" aria-hidden />
            )}
            <span>{copyState === "success" ? "Copied" : "Copy"}</span>
          </button>
          <span
            role="status"
            aria-live="polite"
            className="text-xs font-medium text-emerald-700 transition-opacity dark:text-emerald-200"
          >
            {copyState === "success" ? "Copied to clipboard" : copyState === "error" ? "Clipboard not available" : ""}
          </span>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-indigo-100 bg-white/90 p-4 shadow-sm dark:border-indigo-800 dark:bg-zinc-950/40">
        {entry.intro.map((paragraph) => (
          <p key={paragraph} className="text-base leading-relaxed text-zinc-800 dark:text-zinc-100">
            {paragraph}
          </p>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {entry.sections.map((section) => (
          <div
            key={section.heading}
            className="space-y-2 rounded-2xl border border-indigo-100 bg-white/90 p-4 shadow-sm dark:border-indigo-800 dark:bg-zinc-900/70"
          >
            <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100">{section.heading}</h3>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph} className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
                {paragraph}
              </p>
            ))}
            {section.bullets ? (
              <ul className="list-disc space-y-2 pl-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>

      {additionalContent ? <div className="space-y-4">{additionalContent}</div> : null}

      {entry.links?.length ? (
        <div className="flex flex-wrap gap-3 rounded-2xl bg-indigo-50/60 p-4 text-sm font-semibold text-indigo-800 ring-1 ring-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-100 dark:ring-indigo-900/60">
          {entry.links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={
                isDecisionSop
                  ? "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-indigo-700 underline decoration-indigo-200 underline-offset-4 transition hover:text-indigo-900 hover:decoration-indigo-400 dark:text-indigo-100 dark:hover:text-indigo-50"
                  : "inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-indigo-700 ring-1 ring-indigo-200 transition hover:-translate-y-0.5 hover:ring-indigo-300 dark:bg-indigo-900/60 dark:text-indigo-100 dark:ring-indigo-800/60"
              }
            >
              {link.label}
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}
