import Link from "next/link";

import { DidWeReinventBullhorn } from "./DidWeReinventBullhorn";
import { ETEClientLayout } from "@/components/ETEClientLayout";
import { eteVsBullhornContent } from "@/content/help/eteVsBullhorn";

export default function HelpPage() {
  return (
    <ETEClientLayout maxWidthClassName="max-w-5xl" contentClassName="space-y-8">
      <header className="overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-6 shadow-sm dark:border-indigo-900/40 dark:from-indigo-950/60 dark:via-zinc-950 dark:to-emerald-950/40">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Help &amp; FAQ</p>
            <h1 className="text-4xl font-semibold leading-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">Quick answers about ETE</h1>
            <p className="max-w-3xl text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              Short explainers your team can reference without leaving the app. Start with how ETE and Bullhorn fit together.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-indigo-200 bg-white/90 px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800 dark:border-indigo-900/60 dark:bg-zinc-900/70 dark:text-indigo-100"
          >
            Back to Console
          </Link>
        </div>
      </header>

      <DidWeReinventBullhorn entry={eteVsBullhornContent} />

      <section className="rounded-3xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">SOP</p>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Sourcing &amp; Recruiting SOPs</h2>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Access the verbatim Quick Guide and full SOP for sourcing and recruiting. Read-only reference with anchor navigation.
            </p>
          </div>
          <Link
            href="/ete/sourcing-recruiting-sop"
            className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-indigo-200 bg-white/90 px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800 dark:border-indigo-900/60 dark:bg-zinc-900/70 dark:text-indigo-100"
          >
            Open SOP
          </Link>
        </div>
      </section>
    </ETEClientLayout>
  );
}
