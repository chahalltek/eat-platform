import type { ReactNode } from "react";
import Link from "next/link";

import { ClientActionLink } from "@/components/ClientActionLink";
import { ETEClientLayout } from "@/components/ETEClientLayout";

type SopCardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

function SopCard({ title, subtitle, children }: SopCardProps) {
  return (
    <div className="h-full rounded-2xl border border-indigo-100/80 bg-white/90 p-5 shadow-sm ring-1 ring-indigo-50 transition hover:-translate-y-[1px] hover:shadow-md dark:border-indigo-900/40 dark:bg-zinc-900/70 dark:ring-indigo-900/30">
      <div className="space-y-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-300">{subtitle}</p>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function SourcingRecruitingSopPage() {
  const bodyTextClass = "text-sm leading-relaxed text-zinc-700 dark:text-zinc-200";
  const listClass = "list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200";
  const orderedListClass = "list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200";

  return (
    <ETEClientLayout maxWidthClassName="max-w-6xl" contentClassName="space-y-8">
      <header className="overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-6 shadow-sm dark:border-indigo-900/40 dark:from-indigo-950/60 dark:via-zinc-950 dark:to-emerald-950/40">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">SOP</p>
            <h1 className="text-4xl font-semibold leading-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">Sourcing &amp; Recruiting SOPs</h1>
            <p className="max-w-3xl text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              Read-only, verbatim SOPs for sourcing and recruiting. Quick Guide appears first, followed by the full SOP reference.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <a
                href="#quick-guide"
                className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/90 px-3 py-2 text-sm font-semibold text-indigo-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800 dark:border-indigo-900/60 dark:bg-zinc-900/70 dark:text-indigo-100"
              >
                Quick Guide
              </a>
              <a
                href="#full-sop"
                className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/90 px-3 py-2 text-sm font-semibold text-indigo-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800 dark:border-indigo-900/60 dark:bg-zinc-900/70 dark:text-indigo-100"
              >
                Full SOP
              </a>
            </div>
          </div>
          <ClientActionLink href="/">Back to Console</ClientActionLink>
        </div>
      </header>

      <section
        id="quick-guide"
        className="space-y-4 rounded-3xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Scannable SOP</p>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Quick Guide</h2>
          </div>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-800 ring-1 ring-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-100 dark:ring-indigo-800/60">
            Read-only
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SopCard title="Purpose">
            <p className={bodyTextClass}>This SOP explains who does what, when, and how decisions are made clearly and consistently.</p>
            <p className={bodyTextClass}>The goal is to replace undocumented judgment with structured clarity, not to add process.</p>
          </SopCard>

          <SopCard title="Core Principles">
            <ul className={listClass}>
              <li>Sourcing expands options</li>
              <li>Recruiting decides</li>
              <li>Decisions must be explainable</li>
              <li>Confidence and risk are explicit</li>
              <li>Outcomes help us improve over time</li>
            </ul>
          </SopCard>

          <SopCard title="Sourcing: What You Own" subtitle="Input quality, not final choice">
            <div className="space-y-3">
              <div className="rounded-xl border border-indigo-100/70 bg-indigo-50/50 px-3 py-2 dark:border-indigo-900/60 dark:bg-indigo-950/40">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-200">Responsibilities</p>
                <ul className={listClass}>
                  <li>Build and expand qualified candidate pools</li>
                  <li>Surface relevant skills, experience, and availability</li>
                  <li>Stress-test assumptions and widen optionality</li>
                  <li>Adjust sourcing strategy based on recruiter feedback and market signals</li>
                </ul>
              </div>
              <div className="rounded-xl border border-amber-100/80 bg-amber-50/60 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/40">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800 dark:text-amber-200">Does Not Own</p>
                <ul className={listClass}>
                  <li>Final candidate ranking</li>
                  <li>Submission recommendations</li>
                  <li>Decision tradeoffs or rationale</li>
                </ul>
              </div>
              <p className={bodyTextClass}>Sourcing ends when a strong pool of options exists.</p>
            </div>
          </SopCard>

          <SopCard title="Recruiting: What You Own" subtitle="Judgment and accountability">
            <ul className={listClass}>
              <li>Clarify role requirements when they are vague or conflicting</li>
              <li>Compare candidates explicitly (not in isolation)</li>
              <li>Make tradeoffs visible (speed vs quality, rate vs experience, risk vs upside)</li>
              <li>Assign confidence at decision time</li>
              <li>Stand behind submission and rejection decisions</li>
            </ul>
            <p className={bodyTextClass}>Recruiting is where decisions are made and explained.</p>
          </SopCard>

          <SopCard title="Decision Expectations">
            <p className={bodyTextClass}>At key decision moments, recruiters are expected to:</p>
            <ul className={listClass}>
              <li>Be explicit about why a candidate is recommended</li>
              <li>Acknowledge known risks or unknowns</li>
              <li>Capture confidence in the decision</li>
              <li>Avoid relying on verbal or undocumented reasoning</li>
            </ul>
          </SopCard>

          <SopCard title="Structured Decision Support" subtitle="Use the tooling to clarify judgment">
            <ul className={listClass}>
              <li>Document tradeoffs and rationale</li>
              <li>Capture confidence and risk consistently</li>
              <li>Produce clear explanations for internal and client communication</li>
            </ul>
            <p className={bodyTextClass}>This is support, not automation replacing judgment.</p>
          </SopCard>

          <SopCard title="Sharing &amp; Transparency">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-100/80 bg-emerald-50/50 px-3 py-2 dark:border-emerald-900/50 dark:bg-emerald-950/40">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800 dark:text-emerald-200">Shareable</p>
                <ul className={listClass}>
                  <li>Submission decisions</li>
                  <li>Decision summaries</li>
                  <li>Candidate explanations</li>
                </ul>
              </div>
              <div className="rounded-xl border border-zinc-200/80 bg-zinc-50 px-3 py-2 dark:border-zinc-800/70 dark:bg-zinc-950/60">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-800 dark:text-zinc-200">Internal Only</p>
                <ul className={listClass}>
                  <li>Detailed decision logic</li>
                  <li>Confidence calibration history</li>
                  <li>Tradeoff models</li>
                </ul>
              </div>
            </div>
          </SopCard>

          <SopCard title="Accountability">
            <ul className={listClass}>
              <li>Recruiters own final decisions</li>
              <li>AI and automation inform decisions but do not make them</li>
              <li>Low-confidence decisions should be escalated</li>
              <li>Outcomes are used to improve future judgment</li>
            </ul>
            <div className="mt-4 rounded-xl border border-indigo-100/80 bg-indigo-50/70 px-3 py-2 text-sm font-semibold text-indigo-900 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-100">
              In one line: Sourcing expands the field. Recruiting decides. Judgment is explicit. Confidence is captured.
            </div>
          </SopCard>
        </div>
      </section>

      <section
        id="full-sop"
        className="space-y-6 rounded-3xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Reference</p>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Full Sourcing &amp; Recruiting SOP</h2>
          </div>
          <Link
            href="#quick-guide"
            className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-indigo-200 bg-white/90 px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800 dark:border-indigo-900/60 dark:bg-zinc-900/70 dark:text-indigo-100"
          >
            Back to Quick Guide
          </Link>
        </div>

        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <SopCard title="Purpose">
              <p className={bodyTextClass}>
                These SOPs define how Sourcing and Recruiting operate together to deliver high-quality, defensible hiring decisions at
                scale. The intent is to reduce manual, repetitive work while increasing clarity, confidence, and accountability in
                decision-making.
              </p>
              <p className={bodyTextClass}>
                These SOPs are designed to replace undocumented judgment with structured clarity, not to add unnecessary process
                overhead.
              </p>
            </SopCard>

            <SopCard title="Guiding Principles">
              <ul className={listClass}>
                <li>Sourcing expands and strengthens candidate pools</li>
                <li>Recruiting owns comparison, tradeoffs, and final decisions</li>
                <li>Judgment must be explicit, explainable, and reviewable</li>
                <li>Systems should reduce friction where work is repetitive and add structure where decisions matter</li>
              </ul>
            </SopCard>
          </div>

          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-800 ring-1 ring-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-100 dark:ring-indigo-800/50">
              Sourcing SOP
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <SopCard title="Role of Sourcing">
                <p className={bodyTextClass}>Sourcing is responsible for input optimization, not final selection.</p>
                <p className={bodyTextClass}>The Sourcer’s role is to:</p>
                <ul className={listClass}>
                  <li>Expand the candidate pool</li>
                  <li>Surface diverse and relevant signals</li>
                  <li>Stress-test assumptions</li>
                  <li>Increase optionality for recruiters</li>
                </ul>
                <div className="mt-3 rounded-xl border border-amber-100/80 bg-amber-50/70 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/40">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800 dark:text-amber-200">Sourcing does not</p>
                  <ul className={listClass}>
                    <li>Decide who should be submitted</li>
                    <li>Own candidate tradeoffs</li>
                    <li>Justify final recommendations</li>
                  </ul>
                </div>
              </SopCard>

              <SopCard title="Sourcing Responsibilities">
                <ol className={orderedListClass}>
                  <li>Build and maintain broad, qualified talent pools using approved tools and platforms</li>
                  <li>Optimize search strategies based on role requirements, historical placements, and recruiter feedback</li>
                  <li>Continuously refresh and enrich candidate pipelines to ensure availability and diversity</li>
                  <li>Partner with Recruiting to refine sourcing strategies when market conditions or role requirements shift</li>
                </ol>
              </SopCard>

              <SopCard title="Sourcing Outputs">
                <p className={bodyTextClass}>Sourcing outputs include:</p>
                <ul className={listClass}>
                  <li>Qualified candidate pools</li>
                  <li>Notes on availability, interest, and surface-level fit</li>
                  <li>Market signal observations (e.g., scarcity, rate pressure)</li>
                </ul>
                <p className={bodyTextClass}>Sourcing outputs do not include:</p>
                <ul className={listClass}>
                  <li>Final rankings</li>
                  <li>Submission recommendations</li>
                  <li>Decision rationale</li>
                </ul>
                <p className={bodyTextClass}>Final comparison and decision-making occurs downstream.</p>
              </SopCard>
            </div>
          </div>

          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-800 ring-1 ring-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-100 dark:ring-indigo-800/50">
              Recruiting SOP
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <SopCard title="Role of Recruiting">
                <p className={bodyTextClass}>Recruiting owns judgment and accountability.</p>
                <p className={bodyTextClass}>Recruiters are responsible for:</p>
                <ul className={listClass}>
                  <li>Clarifying ambiguous or conflicting requirements</li>
                  <li>Comparing candidates explicitly</li>
                  <li>Making tradeoffs visible</li>
                  <li>Standing behind submission decisions with confidence</li>
                </ul>
                <p className={bodyTextClass}>Recruiting is where decisions are made and explained.</p>
              </SopCard>

              <SopCard title="Recruiting Responsibilities">
                <ol className={orderedListClass}>
                  <li>Confirm role clarity at intake, resolving ambiguity where requirements conflict or are incomplete</li>
                  <li>Evaluate candidates comparatively, not in isolation</li>
                  <li>Make tradeoffs explicit (e.g., speed vs quality, rate vs experience)</li>
                  <li>Assign and record confidence at decision time</li>
                  <li>Provide clear rationale for submissions, passes, and rejections</li>
                </ol>
              </SopCard>

              <SopCard title="Structured Decision Support (ETE)">
                <p className={bodyTextClass}>Recruiters are expected to use structured decision support at key decision moments to:</p>
                <ul className={listClass}>
                  <li>Document tradeoffs and rationale</li>
                  <li>Capture confidence and known risks</li>
                  <li>Produce clear explanations suitable for internal and client communication</li>
                </ul>
                <p className={bodyTextClass}>This replaces ad-hoc verbal explanations and undocumented reasoning.</p>
              </SopCard>

              <SopCard title="Recruiting Outputs">
                <p className={bodyTextClass}>Recruiting outputs include:</p>
                <ul className={listClass}>
                  <li>Submission decisions</li>
                  <li>Decision summaries and explanations</li>
                  <li>Confidence assessments</li>
                </ul>
                <p className={bodyTextClass}>
                  These outputs may be shared externally as summaries, but the underlying decision logic, confidence calibration, and
                  tradeoff models remain internal.
                </p>
              </SopCard>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <SopCard title="Decision Ownership &amp; Accountability">
              <p className={bodyTextClass}>Recruiters own the final submission decision.</p>
              <p className={bodyTextClass}>Automation, AI recommendations, and sourcing signals inform decisions but do not replace recruiter judgment.</p>
              <p className={bodyTextClass}>Recruiters are expected to:</p>
              <ul className={listClass}>
                <li>Accept responsibility for decisions</li>
                <li>Escalate uncertainty when confidence is low</li>
                <li>Learn from outcomes over time</li>
              </ul>
            </SopCard>

            <SopCard title="What This SOP Is Not">
              <ul className={listClass}>
                <li>It is not an additional approval layer</li>
                <li>It is not a replacement for professional judgment</li>
                <li>It is not a mandate to over-document</li>
              </ul>
              <p className={bodyTextClass}>It is a framework to ensure that when decisions matter, reasoning is clear, consistent, and defensible.</p>
            </SopCard>

            <SopCard title="Summary">
              <ul className={listClass}>
                <li>Sourcing expands the field of options</li>
                <li>Recruiting decides</li>
                <li>Judgment is explicit</li>
                <li>Confidence is captured</li>
                <li>Outcomes inform improvement</li>
              </ul>
              <p className={bodyTextClass}>This is how we scale without losing trust, quality, or accountability.</p>
            </SopCard>
          </div>
        </div>
      </section>
    </ETEClientLayout>
  );
}
