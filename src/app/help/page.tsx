import Link from "next/link";
import { DocumentTextIcon } from "@heroicons/react/24/outline";

import { DidWeReinventBullhorn } from "./DidWeReinventBullhorn";
import { ETEClientLayout } from "@/components/ETEClientLayout";
import { CopyButton } from "@/components/CopyButton";
import { decisionSopContent, eteVsBullhornContent } from "@/content/help/eteVsBullhorn";
import { sourcingRecruitingSop } from "@/content/help/sourcingRecruitingSop";

export default function HelpPage() {
  return (
    <ETEClientLayout maxWidthClassName="max-w-5xl" contentClassName="space-y-8">
      <header className="overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-6 shadow-sm dark:border-indigo-900/40 dark:from-indigo-950/60 dark:via-zinc-950 dark:to-emerald-950/40">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Help &amp; FAQ</p>
            <h1 className="text-4xl font-semibold leading-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">Quick answers about ETE</h1>
            <p className="max-w-3xl text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              Short, authoritative explainers your team can reference without leaving the app.
              <br />
              <br />
              ETE is an agentic decision-support system where specialized agents reason at key moments, humans retain authority, and judgment is preserved as durable memory.
            </p>
            <div className="rounded-2xl border border-indigo-100 bg-white/80 p-4 text-sm text-zinc-800 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/60 dark:text-zinc-100">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">What this page is for</p>
              <p className="mt-1 text-sm leading-relaxed">
                This page is not training material or user documentation. It exists to align language and decision-making inside ETE.
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-indigo-200 bg-white/90 px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800 dark:border-indigo-900/60 dark:bg-zinc-900/70 dark:text-indigo-100"
          >
            Back to Console
          </Link>
        </div>
      </header>

      <section id="where-is-the-sop" className="space-y-3 rounded-3xl border border-indigo-100 bg-white/90 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-100 dark:ring-indigo-900/50">
              <DocumentTextIcon className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">SOP</p>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{sourcingRecruitingSop.title}</h2>
              <p className="text-sm text-zinc-700 dark:text-zinc-200">
                This SOP defines how sourcing and recruiting decisions are made, recorded, and explained inside ETE.
              </p>
            </div>
          </div>
          <Link
            href="/help/sop"
            className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-100 hover:text-indigo-800 focus:outline-none focus-visible:ring focus-visible:ring-indigo-400/70 dark:border-indigo-900/60 dark:bg-indigo-900/60 dark:text-indigo-100"
          >
            Open SOP
          </Link>
        </div>
        <div className="grid gap-3 text-xs text-indigo-900 sm:grid-cols-3 dark:text-indigo-100">
          <div className="rounded-2xl bg-indigo-50/70 px-3 py-2 ring-1 ring-indigo-100 dark:bg-indigo-950/40 dark:ring-indigo-900/50">
            <p className="font-semibold">Version</p>
            <p className="text-sm text-zinc-700 dark:text-zinc-200">{sourcingRecruitingSop.version}</p>
          </div>
          <div className="rounded-2xl bg-indigo-50/70 px-3 py-2 ring-1 ring-indigo-100 dark:bg-indigo-950/40 dark:ring-indigo-900/50">
            <p className="font-semibold">Last updated</p>
            <p className="text-sm text-zinc-700 dark:text-zinc-200">{sourcingRecruitingSop.lastUpdated}</p>
          </div>
          <div className="rounded-2xl bg-indigo-50/70 px-3 py-2 ring-1 ring-indigo-100 dark:bg-indigo-950/40 dark:ring-indigo-900/50">
            <p className="font-semibold">Owner</p>
            <p className="text-sm text-zinc-700 dark:text-zinc-200">{sourcingRecruitingSop.owner}</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-indigo-100 bg-white/90 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Common questions</p>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Jump to an answer</h2>
          </div>
          <div className="grid gap-2 text-sm text-indigo-800 sm:grid-cols-2 sm:text-base dark:text-indigo-100">
            <a className="rounded-xl bg-indigo-50/70 px-3 py-2 ring-1 ring-indigo-100 transition hover:-translate-y-0.5 hover:ring-indigo-200 dark:bg-indigo-950/40 dark:ring-indigo-900/60" href="#how-decisions-are-made">
              How are decisions made here?
            </a>
            <a className="rounded-xl bg-indigo-50/70 px-3 py-2 ring-1 ring-indigo-100 transition hover:-translate-y-0.5 hover:ring-indigo-200 dark:bg-indigo-950/40 dark:ring-indigo-900/60" href="#did-we-reinvent-bullhorn">
              Did we reinvent Bullhorn?
            </a>
            <a className="rounded-xl bg-indigo-50/70 px-3 py-2 ring-1 ring-indigo-100 transition hover:-translate-y-0.5 hover:ring-indigo-200 dark:bg-indigo-950/40 dark:ring-indigo-900/60" href="#where-is-the-sop">
              Where is the SOP?
            </a>
            <a className="rounded-xl bg-indigo-50/70 px-3 py-2 ring-1 ring-indigo-100 transition hover:-translate-y-0.5 hover:ring-indigo-200 dark:bg-indigo-950/40 dark:ring-indigo-900/60" href="#hm-language">
              What language should I use with hiring managers?
            </a>
          </div>
        </div>
      </section>

      <div className="space-y-6">
        <DidWeReinventBullhorn
          entry={decisionSopContent}
          anchorId="how-decisions-are-made"
          additionalContent={
            <div
              id="hm-language"
              className="flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 shadow-sm dark:border-indigo-900/50 dark:bg-indigo-950/30"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
                    What language should I use with hiring managers?
                  </p>
                  <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100">Hiring manager language (copy/paste)</h3>
                </div>
                <CopyButton text="Bullhorn is the system of record. ETE is where we capture rationale, confidence, and tradeoffs at decision moments so we can explain decisions consistently and learn from outcomes." label="Copy" />
              </div>
              <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-100">
                Bullhorn is the system of record. ETE is where we capture rationale, confidence, and tradeoffs at decision moments so we can explain decisions consistently and learn from outcomes.
              </p>
            </div>
          }
        />
        <DidWeReinventBullhorn entry={eteVsBullhornContent} anchorId="did-we-reinvent-bullhorn" />
      </div>

      <section className="rounded-3xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Related references</p>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Sourcing &amp; Recruiting SOPs</h2>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Access the verbatim Quick Guide and full SOP for sourcing and recruiting. Read-only reference with anchor navigation.
            </p>
          </div>
          <Link
            href="/ete/sourcing-recruiting-sop"
            className="inline-flex items-center justify-center gap-2 self-start rounded-md px-3 py-2 text-sm font-semibold text-indigo-700 underline decoration-indigo-200 underline-offset-4 transition hover:text-indigo-900 hover:decoration-indigo-400 dark:text-indigo-100 dark:hover:text-indigo-50"
          >
            Open SOP
          </Link>
        </div>
      </section>
    </ETEClientLayout>
  );
}
