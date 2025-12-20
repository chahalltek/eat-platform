"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";

type SopContext = "intake" | "comparison" | "submission";

type SopContent = {
  title: string;
  description: string;
  checklist: Array<{ title: string; detail: string }>;
  signals: string[];
};

const SOP_COPY: Record<SopContext, SopContent> = {
  intake: {
    title: "Intake decision expectations",
    description: "Capture the minimum to move forward without slowing the recruiter or hiring team.",
    checklist: [
      { title: "Must-haves vs flex", detail: "Call out the few non-negotiables and what can flex if the pool is thin." },
      { title: "Dealbreakers", detail: "Eligibility, travel, clearance, or comp blockers need a note before handoff." },
      { title: "Ambiguity path", detail: "List the unknowns and who will get the answers—no form reruns needed." },
      { title: "Market friction", detail: "Set expectations when supply is tight or the description is still messy." },
    ],
    signals: [
      "Decision maker and approval path",
      "Target profile in one sentence",
      "Top 3 evaluation drivers",
      "Next touchpoint with date/owner",
    ],
  },
  comparison: {
    title: "Comparison decision expectations",
    description: "Stay consistent when ranking candidates—scores guide, evidence decides.",
    checklist: [
      { title: "Lead with must-haves", detail: "Confirm required skills are present before relying on scores." },
      { title: "Balance confidence", detail: "Flag low-confidence matches and note the gap instead of ignoring them." },
      { title: "Surface risks early", detail: "Eligibility, compensation, or availability issues get called out first." },
      { title: "Pick the why", detail: "Document the rationale for the top recommendation and one close alternate." },
    ],
    signals: [
      "Coverage of must-have skills and role level",
      "Evidence for the recommendation (links, notes, outcomes)",
      "Risks or blockers that require hiring manager input",
      "Follow-up asks before moving forward",
    ],
  },
  submission: {
    title: "Submission & recommendation expectations",
    description: "Recommendations should be crisp, reversible, and ready for ATS sync.",
    checklist: [
      { title: "Align to the rec", detail: "If you override, capture the reason—client feedback, context, or data gap." },
      { title: "Proof before push", detail: "Verify contact info, consent, and latest notes before sending externally." },
      { title: "Next owner", detail: "Tag who picks it up next and the expected response time." },
      { title: "No blockers hiding", detail: "Call out tradeoffs, risks, or missing signals in the note, not just the score." },
    ],
    signals: [
      "Recommended outcome and confidence",
      "Rationale in one or two sentences",
      "Blocking risks or dependencies",
      "Next action and expected timeframe",
    ],
  },
};

type SopContextualLinkProps = {
  context: SopContext;
  className?: string;
};

export function SopContextualLink({ context, className }: SopContextualLinkProps) {
  const [open, setOpen] = useState(false);
  const content = useMemo(() => SOP_COPY[context], [context]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={clsx(
          "inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800 ring-1 ring-indigo-100 transition hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
          className,
        )}
        onClick={() => setOpen(true)}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" aria-hidden />
        View decision expectations (SOP)
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-end bg-slate-900/30 px-4 py-8 sm:px-6"
          role="dialog"
          aria-modal="true"
          aria-label="Decision expectations SOP"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative h-full w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-indigo-100"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-indigo-100 bg-indigo-50/70 px-5 py-4">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700">Decision moment</p>
                <h2 className="text-lg font-semibold text-indigo-900">{content.title}</h2>
                <p className="text-sm text-indigo-800/90">{content.description}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-800 ring-1 ring-indigo-100 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                Close
              </button>
            </div>

            <div className="flex h-[75vh] flex-col gap-4 overflow-y-auto px-5 py-5">
              <section className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Quick checklist</p>
                <ul className="space-y-3">
                  {content.checklist.map((item) => (
                    <li key={item.title} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-indigo-500" aria-hidden />
                      <div className="space-y-0.5 text-sm">
                        <p className="font-semibold text-slate-900">{item.title}</p>
                        <p className="text-slate-700">{item.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-700">Signals to capture</p>
                <ul className="mt-3 space-y-2">
                  {content.signals.map((signal) => (
                    <li key={signal} className="flex items-start gap-2 text-sm text-indigo-900">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden />
                      <span>{signal}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

