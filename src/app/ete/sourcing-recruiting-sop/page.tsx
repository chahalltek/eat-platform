import Link from "next/link";

import { ClientActionLink } from "@/components/ClientActionLink";
import { ETEClientLayout } from "@/components/ETEClientLayout";

export default function SourcingRecruitingSopPage() {
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

        <div className="prose prose-indigo max-w-none dark:prose-invert">
          <h3>Purpose</h3>
          <p>This SOP explains who does what, when, and how decisions are made clearly and consistently.</p>
          <p>The goal is to replace undocumented judgment with structured clarity, not to add process.</p>

          <h3>Core Principles</h3>
          <ul>
            <li>Sourcing expands options</li>
            <li>Recruiting decides</li>
            <li>Decisions must be explainable</li>
            <li>Confidence and risk are explicit</li>
            <li>Outcomes help us improve over time</li>
          </ul>

          <h3>Sourcing: What You Own</h3>
          <p>Sourcing is about input quality, not final choice.</p>
          <p><strong>Responsibilities</strong></p>
          <ul>
            <li>Build and expand qualified candidate pools</li>
            <li>Surface relevant skills, experience, and availability</li>
            <li>Stress-test assumptions and widen optionality</li>
            <li>Adjust sourcing strategy based on recruiter feedback and market signals</li>
          </ul>
          <p><strong>Does Not Own</strong></p>
          <ul>
            <li>Final candidate ranking</li>
            <li>Submission recommendations</li>
            <li>Decision tradeoffs or rationale</li>
          </ul>
          <p>Sourcing ends when a strong pool of options exists.</p>

          <h3>Recruiting: What You Own</h3>
          <p>Recruiting owns judgment and accountability.</p>
          <p><strong>Responsibilities</strong></p>
          <ul>
            <li>Clarify role requirements when they are vague or conflicting</li>
            <li>Compare candidates explicitly (not in isolation)</li>
            <li>Make tradeoffs visible (speed vs quality, rate vs experience, risk vs upside)</li>
            <li>Assign confidence at decision time</li>
            <li>Stand behind submission and rejection decisions</li>
          </ul>
          <p>Recruiting is where decisions are made and explained.</p>

          <h3>Decision Expectations</h3>
          <p>At key decision moments, recruiters are expected to:</p>
          <ul>
            <li>Be explicit about why a candidate is recommended</li>
            <li>Acknowledge known risks or unknowns</li>
            <li>Capture confidence in the decision</li>
            <li>Avoid relying on verbal or undocumented reasoning</li>
          </ul>

          <h3>Use of Structured Decision Support</h3>
          <p>Structured decision support is used to:</p>
          <ul>
            <li>Document tradeoffs and rationale</li>
            <li>Capture confidence and risk consistently</li>
            <li>Produce clear explanations for internal and client communication</li>
          </ul>
          <p>This is support, not automation replacing judgment.</p>

          <h3>What Gets Shared (and What Doesn’t)</h3>
          <p><strong>Shareable</strong></p>
          <ul>
            <li>Submission decisions</li>
            <li>Decision summaries</li>
            <li>Candidate explanations</li>
          </ul>
          <p><strong>Internal Only</strong></p>
          <ul>
            <li>Detailed decision logic</li>
            <li>Confidence calibration history</li>
            <li>Tradeoff models</li>
          </ul>

          <h3>Accountability</h3>
          <ul>
            <li>Recruiters own final decisions</li>
            <li>AI and automation inform decisions but do not make them</li>
            <li>Low-confidence decisions should be escalated</li>
            <li>Outcomes are used to improve future judgment</li>
          </ul>

          <h3>In One Line</h3>
          <p>Sourcing expands the field. Recruiting decides. Judgment is explicit. Confidence is captured.</p>
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

        <div className="prose prose-indigo max-w-none dark:prose-invert">
          <h2>Purpose</h2>
          <p>
            These SOPs define how Sourcing and Recruiting operate together to deliver high-quality, defensible hiring decisions at
            scale. The intent is to reduce manual, repetitive work while increasing clarity, confidence, and accountability in
            decision-making.
          </p>
          <p>
            These SOPs are designed to replace undocumented judgment with structured clarity, not to add unnecessary process overhead.
          </p>

          <h2>Guiding Principles</h2>
          <ul>
            <li>Sourcing expands and strengthens candidate pools</li>
            <li>Recruiting owns comparison, tradeoffs, and final decisions</li>
            <li>Judgment must be explicit, explainable, and reviewable</li>
            <li>Systems should reduce friction where work is repetitive and add structure where decisions matter</li>
          </ul>

          <h1>SOURCING SOP</h1>

          <h2>Role of Sourcing</h2>
          <p>Sourcing is responsible for input optimization, not final selection.</p>
          <p>The Sourcer’s role is to:</p>
          <ul>
            <li>Expand the candidate pool</li>
            <li>Surface diverse and relevant signals</li>
            <li>Stress-test assumptions</li>
            <li>Increase optionality for recruiters</li>
          </ul>
          <p>Sourcing does not:</p>
          <ul>
            <li>Decide who should be submitted</li>
            <li>Own candidate tradeoffs</li>
            <li>Justify final recommendations</li>
          </ul>

          <h2>Sourcing Responsibilities</h2>
          <ol>
            <li>Build and maintain broad, qualified talent pools using approved tools and platforms</li>
            <li>Optimize search strategies based on role requirements, historical placements, and recruiter feedback</li>
            <li>Continuously refresh and enrich candidate pipelines to ensure availability and diversity</li>
            <li>Partner with Recruiting to refine sourcing strategies when market conditions or role requirements shift</li>
          </ol>

          <h2>Sourcing Outputs</h2>
          <p>Sourcing outputs include:</p>
          <ul>
            <li>Qualified candidate pools</li>
            <li>Notes on availability, interest, and surface-level fit</li>
            <li>Market signal observations (e.g., scarcity, rate pressure)</li>
          </ul>
          <p>Sourcing outputs do not include:</p>
          <ul>
            <li>Final rankings</li>
            <li>Submission recommendations</li>
            <li>Decision rationale</li>
          </ul>
          <p>Final comparison and decision-making occurs downstream.</p>

          <h1>RECRUITING SOP</h1>

          <h2>Role of Recruiting</h2>
          <p>Recruiting owns judgment and accountability.</p>
          <p>Recruiters are responsible for:</p>
          <ul>
            <li>Clarifying ambiguous or conflicting requirements</li>
            <li>Comparing candidates explicitly</li>
            <li>Making tradeoffs visible</li>
            <li>Standing behind submission decisions with confidence</li>
          </ul>
          <p>Recruiting is where decisions are made and explained.</p>

          <h2>Recruiting Responsibilities</h2>
          <ol>
            <li>Confirm role clarity at intake, resolving ambiguity where requirements conflict or are incomplete</li>
            <li>Evaluate candidates comparatively, not in isolation</li>
            <li>Make tradeoffs explicit (e.g., speed vs quality, rate vs experience)</li>
            <li>Assign and record confidence at decision time</li>
            <li>Provide clear rationale for submissions, passes, and rejections</li>
          </ol>

          <h2>Use of Structured Decision Support (ETE)</h2>
          <p>Recruiters are expected to use structured decision support at key decision moments to:</p>
          <ul>
            <li>Document tradeoffs and rationale</li>
            <li>Capture confidence and known risks</li>
            <li>Produce clear explanations suitable for internal and client communication</li>
          </ul>
          <p>This replaces ad-hoc verbal explanations and undocumented reasoning.</p>

          <h2>Recruiting Outputs</h2>
          <p>Recruiting outputs include:</p>
          <ul>
            <li>Submission decisions</li>
            <li>Decision summaries and explanations</li>
            <li>Confidence assessments</li>
          </ul>
          <p>
            These outputs may be shared externally as summaries, but the underlying decision logic, confidence calibration, and
            tradeoff models remain internal.
          </p>

          <h2>Decision Ownership &amp; Accountability</h2>
          <p>Recruiters own the final submission decision.</p>
          <p>Automation, AI recommendations, and sourcing signals inform decisions but do not replace recruiter judgment.</p>
          <p>Recruiters are expected to:</p>
          <ul>
            <li>Accept responsibility for decisions</li>
            <li>Escalate uncertainty when confidence is low</li>
            <li>Learn from outcomes over time</li>
          </ul>

          <h2>What This SOP Is Not</h2>
          <ul>
            <li>It is not an additional approval layer</li>
            <li>It is not a replacement for professional judgment</li>
            <li>It is not a mandate to over-document</li>
          </ul>
          <p>It is a framework to ensure that when decisions matter, reasoning is clear, consistent, and defensible.</p>

          <h2>Summary</h2>
          <ul>
            <li>Sourcing expands the field of options</li>
            <li>Recruiting decides</li>
            <li>Judgment is explicit</li>
            <li>Confidence is captured</li>
            <li>Outcomes inform improvement</li>
          </ul>
          <p>This is how we scale without losing trust, quality, or accountability.</p>
        </div>
      </section>
    </ETEClientLayout>
  );
}
