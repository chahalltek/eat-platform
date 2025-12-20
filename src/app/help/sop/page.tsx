import Link from "next/link";
import { ArrowLeftIcon, DocumentTextIcon, LinkIcon } from "@heroicons/react/24/outline";

import { ETEClientLayout } from "@/components/ETEClientLayout";
import { sourcingRecruitingSop, type SopSection, type SopSubsection } from "@/content/help/sourcingRecruitingSop";

function SopSubsectionBlock({ subsection }: { subsection: SopSubsection }) {
  return (
    <div id={subsection.id} className="scroll-mt-28 space-y-2 rounded-2xl border border-indigo-50 bg-indigo-50/40 p-4 dark:border-indigo-900/60 dark:bg-zinc-900/60">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100">{subsection.title}</h3>
        <a
          href={`#${subsection.id}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-indigo-500 transition hover:-translate-y-0.5 hover:text-indigo-700 focus:outline-none focus-visible:ring focus-visible:ring-indigo-400/70 dark:text-indigo-200 dark:hover:text-indigo-50"
          aria-label={`Anchor link for ${subsection.title}`}
        >
          <LinkIcon className="h-4 w-4" aria-hidden />
        </a>
      </div>
      {subsection.body?.map((paragraph) => (
        <p key={paragraph} className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
          {paragraph}
        </p>
      ))}
      {subsection.bullets ? (
        <ul className="list-disc space-y-2 pl-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
          {subsection.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      ) : null}
      {subsection.steps ? (
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
          {subsection.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function SopSectionCard({ section }: { section: SopSection }) {
  return (
    <section
      id={section.id}
      className="scroll-mt-32 space-y-4 rounded-3xl border border-indigo-100 bg-white/90 p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-indigo-900/50 dark:bg-zinc-900/70"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300">Section</p>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{section.title}</h2>
          {section.summary ? (
            <p className="max-w-4xl text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{section.summary}</p>
          ) : null}
        </div>
        <a
          href={`#${section.id}`}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-indigo-100 bg-white text-indigo-500 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-700 focus:outline-none focus-visible:ring focus-visible:ring-indigo-400/70 dark:border-indigo-800 dark:bg-zinc-950/50 dark:text-indigo-200 dark:hover:text-indigo-50"
          aria-label={`Anchor link for ${section.title}`}
        >
          <LinkIcon className="h-5 w-5" aria-hidden />
        </a>
      </div>

      {section.body?.map((paragraph) => (
        <p key={paragraph} className="text-base leading-relaxed text-zinc-800 dark:text-zinc-100">
          {paragraph}
        </p>
      ))}

      {section.bullets ? (
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
          {section.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      ) : null}

      {section.steps ? (
        <ol className="list-decimal space-y-3 pl-6 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
          {section.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : null}

      {section.subsections?.length ? (
        <div className="space-y-5 border-t border-indigo-50 pt-4 dark:border-indigo-900/40">
          {section.subsections.map((subsection) => (
            <SopSubsectionBlock key={subsection.id} subsection={subsection} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function AnchorListItem({ section }: { section: SopSection }) {
  return (
    <li className="space-y-2">
      <Link
        href={`#${section.id}`}
        className="group flex items-start gap-2 rounded-lg px-2 py-1 text-sm font-semibold text-indigo-900 transition hover:-translate-y-0.5 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus-visible:ring focus-visible:ring-indigo-400/70 dark:text-indigo-50 dark:hover:bg-indigo-900/60"
      >
        <span className="mt-[2px] inline-flex h-1.5 w-1.5 rounded-full bg-indigo-400 group-hover:bg-indigo-500 dark:bg-indigo-500" aria-hidden />
        <span>{section.title}</span>
      </Link>
      {section.subsections?.length ? (
        <ul className="space-y-1 border-l border-indigo-100 pl-4 text-xs text-zinc-600 dark:border-indigo-900/60 dark:text-zinc-300">
          {section.subsections.map((subsection) => (
            <li key={subsection.id}>
              <Link
                href={`#${subsection.id}`}
                className="group inline-flex items-center gap-2 rounded px-1 py-0.5 transition hover:bg-indigo-50 hover:text-indigo-800 focus:outline-none focus-visible:ring focus-visible:ring-indigo-400/70 dark:hover:bg-indigo-900/60"
              >
                <span className="inline-flex h-1 w-1 rounded-full bg-indigo-300 group-hover:bg-indigo-500 dark:bg-indigo-500" aria-hidden />
                <span>{subsection.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default function SourcingRecruitingSopPage() {
  const { title, description, sections, owner, version, lastUpdated, contact } = sourcingRecruitingSop;

  return (
    <ETEClientLayout maxWidthClassName="max-w-7xl" contentClassName="pb-16">
      <div className="space-y-8" id="top">
        <div className="flex flex-col gap-4 rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-6 shadow-sm dark:border-indigo-900/50 dark:from-indigo-950/50 dark:via-zinc-950 dark:to-emerald-950/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-700 dark:text-indigo-200">
                <DocumentTextIcon className="h-4 w-4" aria-hidden /> In-App SOP
              </p>
              <h1 className="text-4xl font-semibold leading-tight text-zinc-900 dark:text-zinc-50">{title}</h1>
              <p className="max-w-4xl text-base leading-relaxed text-zinc-700 dark:text-zinc-200">{description}</p>
              <div className="flex flex-wrap gap-3 text-xs font-semibold text-indigo-800 dark:text-indigo-200">
                <span className="rounded-full bg-white/80 px-3 py-1 ring-1 ring-indigo-200 dark:bg-indigo-950/40 dark:ring-indigo-800">Owner: {owner}</span>
                <span className="rounded-full bg-white/80 px-3 py-1 ring-1 ring-indigo-200 dark:bg-indigo-950/40 dark:ring-indigo-800">Version: {version}</span>
                <span className="rounded-full bg-white/80 px-3 py-1 ring-1 ring-indigo-200 dark:bg-indigo-950/40 dark:ring-indigo-800">Last updated: {lastUpdated}</span>
                <Link
                  href={`mailto:${contact}`}
                  className="rounded-full bg-white/80 px-3 py-1 ring-1 ring-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-50 hover:text-indigo-800 dark:bg-indigo-950/40 dark:ring-indigo-800"
                >
                  Contact: {contact}
                </Link>
              </div>
            </div>
            <div className="flex items-start justify-end gap-3">
              <Link
                href="/help"
                className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800 focus:outline-none focus-visible:ring focus-visible:ring-indigo-400/70 dark:border-indigo-800 dark:bg-zinc-900/70 dark:text-indigo-100"
              >
                <ArrowLeftIcon className="h-4 w-4" aria-hidden />
                Back to Help
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-zinc-700 dark:text-zinc-200">
            <span className="rounded-lg bg-white/80 px-3 py-2 ring-1 ring-indigo-100 dark:bg-indigo-950/40 dark:ring-indigo-900/60">
              Read-only reference with anchors for quick navigation.
            </span>
            <span className="rounded-lg bg-white/80 px-3 py-2 ring-1 ring-indigo-100 dark:bg-indigo-950/40 dark:ring-indigo-900/60">
              Keep Bullhorn as system of record; use this page for the enhanced SOP steps.
            </span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <article className="space-y-8">
            {sections.map((section) => (
              <SopSectionCard key={section.id} section={section} />
            ))}
          </article>

          <aside className="hidden lg:block">
            <div className="sticky top-6 space-y-4 rounded-3xl border border-indigo-100 bg-white/90 p-4 shadow-sm dark:border-indigo-900/50 dark:bg-zinc-900/70">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Anchors</p>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Sections</h3>
                </div>
                <Link
                  href="#top"
                  className="inline-flex items-center gap-1 rounded-full border border-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-800 focus:outline-none focus-visible:ring focus-visible:ring-indigo-400/70 dark:border-indigo-800 dark:text-indigo-100"
                >
                  Back to top
                </Link>
              </div>
              <ol className="space-y-2">
                {sections.map((section) => (
                  <AnchorListItem key={section.id} section={section} />
                ))}
              </ol>
            </div>
          </aside>
        </div>
      </div>
    </ETEClientLayout>
  );
}
