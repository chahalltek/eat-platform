import Link from "next/link";

import { EATClientLayout } from "@/components/EATClientLayout";

const Divider = () => <div className="h-px w-full bg-zinc-200 dark:bg-zinc-800" />;

export default function AboutEatPage() {
  return (
    <EATClientLayout>
      <div className="flex flex-col gap-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <nav className="text-sm font-medium text-zinc-500 dark:text-zinc-400" aria-label="Breadcrumb">
              <ol className="flex items-center gap-2">
                <li>
                  <Link href="/" className="hover:text-indigo-600 dark:hover:text-indigo-400">
                    EAT
                  </Link>
                </li>
                <li aria-hidden className="text-zinc-400">
                  /
                </li>
                <li className="text-zinc-700 dark:text-zinc-200">About</li>
              </ol>
            </nav>
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">About EAT</h1>
            <p className="max-w-3xl text-lg text-zinc-600 dark:text-zinc-400">
              How the EDGE Agentic Toolkit powers AI-driven recruiting—from intake to shortlist.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-700 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-indigo-700/60"
          >
            Back to console
          </Link>
        </header>

        <section className="space-y-10 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">What is EAT?</h2>
            <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
              EAT (EDGE Agentic Toolkit) is an AI-driven talent operations system that automates how jobs are understood, candidates are
              interpreted, matches are scored, and shortlists are produced.
            </p>
            <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
              Instead of recruiters manually interpreting resumes and job descriptions, EAT turns both into structured data and lets
              specialized AI agents do the heavy analytical work.
            </p>
            <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
              The result: faster intake, better matches, clearer explanations, and defensible shortlists.
            </p>
          </div>

          <Divider />

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">How EAT Works (High-Level)</h2>
            <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
              EAT is built as a pipeline of specialized agents, each responsible for one stage in the recruiting workflow:
            </p>
            <p className="text-lg font-semibold text-indigo-700 dark:text-indigo-300">INTAKE → PROFILE → MATCHER → CONFIDENCE → EXPLAIN → SHORTLIST</p>
            <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
              Each agent focuses on a single responsibility and hands data to the next step. Recruiters interact with these agents through
              the UI, often without needing to think about the agent names at all.
            </p>
          </div>

          <Divider />

          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">RUA and RINA Explained</h2>
              <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
                You may see two names in the interface that look different from others: <strong>RUA</strong> and <strong>RINA</strong>.
                These are not separate systems. They are simply the entry points into two of the core agents.
              </p>
            </div>

            <div className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">RUA = Role Understanding Agent</h3>
              <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300">This is the job intake interface.</p>
              <ul className="list-disc space-y-2 pl-5 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
                <li>Reads the job description</li>
                <li>Extracts skills, seniority, and constraints</li>
                <li>Identifies must-haves vs nice-to-haves</li>
                <li>Produces a structured job profile</li>
              </ul>
              <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
                In simple terms: <span className="font-semibold">RUA turns job descriptions into structured hiring blueprints.</span>
                This activates the INTAKE agent behind the scenes.
              </p>
            </div>

            <div className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">RINA = Resume Ingestion and Normalization Agent</h3>
              <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300">This is the resume intake interface.</p>
              <ul className="list-disc space-y-2 pl-5 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
                <li>Parses resumes in any format</li>
                <li>Extracts skills, roles, and timelines</li>
                <li>Normalizes inconsistent titles</li>
                <li>Cleans and enriches candidate data</li>
              </ul>
              <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
                In simple terms: <span className="font-semibold">RINA turns resumes into structured candidate profiles.</span> This activates the PROFILE agent behind the scenes.
              </p>
            </div>
          </div>

          <Divider />

          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">The Agents</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">INTAKE Agent (via RUA)</h3>
                <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300">Turns job descriptions into structured data.</p>
                <ul className="list-disc space-y-2 pl-5 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
                  <li>Cleaning up requisitions</li>
                  <li>Extracting skills and seniority</li>
                  <li>Enforcing standard job structure</li>
                </ul>
              </div>

              <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">PROFILE Agent (via RINA)</h3>
                <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300">Turns resumes into structured profiles.</p>
                <ul className="list-disc space-y-2 pl-5 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
                  <li>Resume parsing</li>
                  <li>Skill normalization</li>
                  <li>Profile health scoring</li>
                </ul>
              </div>

              <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">MATCHER Agent</h3>
                <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300">Compares candidates against roles.</p>
                <ul className="list-disc space-y-2 pl-5 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
                  <li>Ranking candidates</li>
                  <li>Filtering by must-haves</li>
                  <li>Producing match percentages</li>
                </ul>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Recruiters usually trigger MATCHER by clicking “Run Matcher” from a job record.</p>
              </div>

              <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">CONFIDENCE Agent</h3>
                <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300">Measures how trustworthy the matches are.</p>
                <ul className="list-disc space-y-2 pl-5 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
                  <li>Risk flags</li>
                  <li>Data completeness checks</li>
                  <li>Quality control</li>
                </ul>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">This agent runs automatically in the background.</p>
              </div>

              <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">EXPLAIN Agent</h3>
                <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300">Translates scores into human reasoning.</p>
                <ul className="list-disc space-y-2 pl-5 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
                  <li>Recruiter notes</li>
                  <li>Hiring manager explanations</li>
                  <li>Justification for rankings</li>
                </ul>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">You typically see this when you click “Explain” on a candidate.</p>
              </div>

              <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">SHORTLIST Agent</h3>
                <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300">Identifies who should be submitted.</p>
                <ul className="list-disc space-y-2 pl-5 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
                  <li>Final recommendations</li>
                  <li>Reducing large match lists down to the best candidates</li>
                </ul>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">This produces the shortlist recruiters actually send forward.</p>
              </div>
            </div>
          </div>

          <Divider />

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Typical Recruiter Workflow</h2>
            <ol className="list-decimal space-y-3 pl-5 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
              <li>
                <strong>Create Job Intake (RUA):</strong> Recruiter enters job information, which runs the INTAKE agent.
              </li>
              <li>
                <strong>Upload Resumes (RINA):</strong> Recruiter uploads candidate resumes, which runs the PROFILE agent.
              </li>
              <li>
                <strong>Run Matcher:</strong> The system scores candidates against the job using the MATCHER agent.
              </li>
              <li>
                <strong>Confidence Analysis Runs Automatically:</strong> The CONFIDENCE agent validates data trustworthiness and flags risks.
              </li>
              <li>
                <strong>Explain on Demand:</strong> The EXPLAIN agent generates reasoning behind matches.
              </li>
              <li>
                <strong>Shortlist Produced:</strong> The SHORTLIST agent returns recommended candidates.
              </li>
            </ol>
          </div>

          <Divider />

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">What Happens Automatically</h2>
            <ul className="list-disc space-y-2 pl-5 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
              <li>CONFIDENCE runs whenever new matches are created.</li>
              <li>PROFILE enrichment runs after resume ingestion.</li>
              <li>EXPLAIN and SHORTLIST can pre-compute for top candidates.</li>
              <li>System health checks validate services in the background.</li>
            </ul>
          </div>

          <Divider />

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">System Status Panel</h2>
            <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
              The System Status panel on the main console shows live health for:
            </p>
            <ul className="list-disc space-y-2 pl-5 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
              <li>Agents</li>
              <li>Scoring Engine</li>
              <li>Database</li>
              <li>Tenant Configuration</li>
            </ul>
            <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
              If something is unhealthy, EAT surfaces it before workflows break.
            </p>
          </div>

          <Divider />

          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">In Summary</h2>
            <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
              RUA and RINA are not extra systems. They are the front doors to the INTAKE and PROFILE agents. Everything else is part of the
              automated flow. EAT is one system with many specialized brains working in sequence.
            </p>
          </div>
        </section>
      </div>
    </EATClientLayout>
  );
}
