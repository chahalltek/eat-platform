import { ClientActionLink } from "@/components/ClientActionLink";
import { ETEClientLayout } from "@/components/ETEClientLayout";

const capabilityPrompts = [
  {
    title: "Why is this candidate ranked #1?",
    detail:
      "Summarizes the evidence, weights, and signals behind the top-ranked candidate. Great for quick validation before scheduling.",
  },
  {
    title: "What questions should I ask in a screen?",
    detail:
      "Turns the profile and ranking signals into screening questions. Keeps recruiters on-script without rereading the role brief.",
  },
];

const highlights = [
  {
    heading: "Side-panel copilot",
    description:
      "Lives next to the Unified console so recruiters never leave the ranking view. Prompts and answers stay contextual to the selected candidate.",
  },
  {
    heading: "Fast prompts",
    description:
      "One-click shortcuts for the two most common recruiter asks. No need to craft prompts or copy/paste role details.",
  },
  {
    heading: "Read-friendly",
    description:
      "Short, scannable answers tuned for handoff. Ideal for busy recruiters who want rationale, not raw logs or agent controls.",
  },
];

const rolloutNotes = [
  "Candidate panel lives inside the Unified console; no new navigation needed.",
  "All answers come from existing ranking signals—no re-ranking or state changes in v1.",
  "Keep scope narrow: rationale + screening questions. More actions can layer on in later versions.",
];

export default function RecruiterCopilotPage() {
  return (
    <ETEClientLayout maxWidthClassName="max-w-5xl" contentClassName="space-y-10">
      <section className="overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-6 shadow-sm dark:border-indigo-900/40 dark:from-indigo-950/60 dark:via-zinc-950 dark:to-emerald-950/40">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">ETE-COPILOT-801</p>
            <h1 className="text-4xl font-semibold leading-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">Recruiter Copilot (v1)</h1>
            <p className="max-w-3xl text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
              Side-panel copilot that keeps recruiters focused on the Unified console. Answers the two fastest-moving questions without
              jumping to docs or pinging hiring managers.
            </p>
          </div>
          <ClientActionLink href="/">Back to Console</ClientActionLink>
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Goal</p>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Make recruiters faster with a contextual copilot</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Centered around the candidate panel in the Unified console so the copilot stays tied to the shortlisting experience.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {highlights.map((item) => (
            <div
              key={item.heading}
              className="space-y-2 rounded-2xl border border-indigo-100 bg-white/90 p-4 shadow-sm dark:border-indigo-800 dark:bg-zinc-900/80"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-300">{item.heading}</p>
              <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 rounded-3xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70 lg:col-span-2">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Capabilities (v1)</p>
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800 ring-1 ring-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-100 dark:ring-emerald-800/60">
              Launch-ready
            </span>
          </div>
          <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">One-click prompts tuned for recruiters</h3>
          <div className="space-y-3 rounded-2xl border border-indigo-100 bg-white/90 p-4 shadow-sm dark:border-indigo-800 dark:bg-zinc-900/80">
            {capabilityPrompts.map((prompt) => (
              <div key={prompt.title} className="space-y-1 rounded-xl bg-indigo-50/60 p-4 ring-1 ring-indigo-100 dark:bg-indigo-950/40 dark:ring-indigo-800/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-base font-semibold text-indigo-900 dark:text-indigo-100">{prompt.title}</h4>
                  <span className="rounded-full bg-indigo-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-900/70 dark:text-indigo-200 dark:ring-indigo-800/70">
                    Prompt
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">{prompt.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-3xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Summaries</p>
          <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Candidate panel on the Unified console</h3>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
            {rolloutNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/80 p-4 text-sm text-indigo-900 shadow-sm dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-100">
            <p className="font-semibold">Positioning</p>
            <p className="mt-1 leading-relaxed">
              Built for recruiters who want rationale and interview prep without touching agent controls. Everything stays scoped to the candidate they are already reviewing.
            </p>
          </div>
        </div>
      </section>
    </ETEClientLayout>
  );
}
