import { ClientActionLink } from "@/components/ClientActionLink";
import { ETEClientLayout } from "@/components/ETEClientLayout";
import { StatusPill } from "@/components/StatusPill";

const roleFamilies = [
  {
    name: "Engineering",
    description: "Backend, frontend, platform, and QA roles that expect technical depth and clear must-haves.",
    cues: ["Must-have clarity", "Code + architecture", "Structured interviews"],
  },
  {
    name: "Data",
    description: "Analytics, data science, and ML roles that blend coding with stakeholder insight.",
    cues: ["SQL + stats", "Portfolio links", "Experimentation"],
  },
  {
    name: "Product",
    description: "Product management roles with narratives, shipped outcomes, and roadmap fluency.",
    cues: ["PRDs", "Roadmaps", "Outcome storytelling"],
  },
  {
    name: "Sales",
    description: "Quota-carrying and GTM roles where ramp and territory context matter most.",
    cues: ["Pipeline health", "Win stories", "Segment context"],
  },
  {
    name: "Operations",
    description: "People, finance, and business operations roles focused on repeatability and controls.",
    cues: ["Process rigor", "Systems access", "Compliance"],
  },
  {
    name: "Custom (tenant-defined)",
    description: "Tenant presets for niche behaviors (e.g., healthcare, hardware, or regional nuances).",
    cues: ["Tenant presets", "Guardrail overrides", "Localized signals"],
  },
];

const classifierSignals = [
  {
    title: "Title cues (deterministic)",
    bullets: [
      "Engineer / Developer / SRE → Engineering",
      "Analytics / Data Science / BI → Data",
      "PM / Program Manager → Product",
      "AE / BDR / GTM / Partnerships → Sales",
      "People Ops / Finance / Compliance → Operations",
    ],
  },
  {
    title: "Skill cues (weighted)",
    bullets: [
      "Programming stacks, CI/CD, and cloud skew Engineering",
      "SQL + experimentation + BI tools skew Data",
      "Roadmaps, PRDs, UX, and stakeholder keywords skew Product",
      "Pipeline, CRM, and quota signals skew Sales",
      "Process, policy, payroll, and ERP signals skew Operations",
    ],
  },
  {
    title: "Deterministic mapping",
    bullets: [
      "Scores title matches 3x heavier than skills; highest score wins",
      "If no matches exist, fall back to tenant-specified family (defaults to Custom)",
      "No LLM calls; the helper is repeatable and auditable",
    ],
  },
];

const roleSignals = [
  {
    family: "Engineering",
    preset: "Skill-forward presets with must-have gating and architecture weighting.",
    shortlist: "Shortlist 8–10 after must-have filters; rerank for system and code samples.",
    postProcessing: "Confidence starts MED/HIGH when repos or design docs exist; Explain leans on build depth.",
  },
  {
    family: "Data",
    preset: "Blend technical weights with stakeholder keywords to separate IC vs lead.",
    shortlist: "Shortlist 6–8 with SQL/experimentation evidence before broadening.",
    postProcessing: "Confidence bands widen unless portfolio links and metrics are present; request enrichment early.",
  },
  {
    family: "Product",
    preset: "Outcome-first presets that boost strategy signals, narratives, and shipped features.",
    shortlist: "Shortlist 5–7 anchored on PRDs, discovery, and cross-functional proof.",
    postProcessing: "Explain calls out metrics ownership and roadmap impact; rerank when outcomes are missing.",
  },
  {
    family: "Sales",
    preset: "Quota attainment + territory presets with stricter recency decay.",
    shortlist: "Shortlist 8–12 with segment fit; preserve MED bands until win stories surface.",
    postProcessing: "Confidence nudges up when pipeline screenshots or OTE alignment exist; decay for stale deals.",
  },
  {
    family: "Operations",
    preset: "Process-control presets that emphasize systems experience and compliance.",
    shortlist: "Shortlist 6–9 with access/certification proof; keep controls visible for auditors.",
    postProcessing: "Confidence stabilizes once policy + controls evidence appears; flag missing audits.",
  },
  {
    family: "Custom (tenant-defined)",
    preset: "Tenant templates inherit nearest family until bespoke signals accumulate.",
    shortlist: "Shortlist sizes mirror the mapped family but keep prompts conservative.",
    postProcessing: "Confidence mirrors the mapped family; Explain documents the tenant preset in use.",
  },
];

const defaultBehaviors = [
  {
    title: "Preset selection",
    tag: "Defaults",
    items: [
      "Job intake runs the deterministic helper on title + skills to pick a role family.",
      "Apply the family’s best-performing preset (weights, guardrails, narratives) on creation.",
      "Confidence + Explain seed prompts with that family’s distribution to avoid cold starts.",
    ],
  },
  {
    title: "Shortlist strategy",
    tag: "Advisory",
    items: [
      "Shortlist targets per family (e.g., 8–10 Engineering, 6–8 Data, 5–7 Product).",
      "MATCH suggestions stay advisory only—recruiters accept or discard; nothing auto-sends.",
      "Scarcity monitors and reranking use family thresholds so gaps appear early.",
    ],
  },
  {
    title: "Admin controls",
    tag: "Override",
    items: [
      "Admins can swap the family or pin a tenant-defined template at any time.",
      "Overrides cascade to MATCH, CONFIDENCE, scarcity, and Explain without editing the JD.",
      "Audit cues stay visible so reviewers know which family + preset was in play.",
    ],
  },
];

export default function RoleFamilyIntelligencePage() {
  return (
    <ETEClientLayout maxWidthClassName="max-w-6xl" contentClassName="space-y-10">
      <section className="overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-6 shadow-sm dark:border-indigo-900/40 dark:from-indigo-950/60 dark:via-zinc-950 dark:to-emerald-950/40">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">ETE-LEARN-1104</p>
            <h1 className="text-4xl font-semibold leading-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">Role family intelligence</h1>
            <p className="max-w-3xl text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
              Teach ETE that different roles behave differently. We classify roles deterministically, aggregate learning by family, and ship defaults that stay advisory until recruiters act.
            </p>
          </div>
          <ClientActionLink href="/">Back to Console</ClientActionLink>
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70">
        <div className="flex items-center gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Role families</p>
          <StatusPill status="enabled" label="Tenant-aware" />
        </div>
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Introduce the role families we learn from</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">Engineering, Data, Product, Sales, Operations, and Custom (tenant-defined) give us predictable patterns without losing flexibility.</p>

        <div className="grid gap-4 md:grid-cols-2">
          {roleFamilies.map((family) => (
            <div
              key={family.name}
              className="space-y-3 rounded-2xl border border-indigo-100 bg-white/90 p-4 shadow-sm dark:border-indigo-800 dark:bg-zinc-900/80"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{family.name}</h3>
                <span className="rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-900/60 dark:text-indigo-200 dark:ring-indigo-800/60">
                  Family
                </span>
              </div>
              <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">{family.description}</p>
              <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-700 dark:text-indigo-200">
                {family.cues.map((cue) => (
                  <span
                    key={cue}
                    className="rounded-full bg-indigo-50 px-2 py-1 ring-1 ring-indigo-100 dark:bg-indigo-900/60 dark:ring-indigo-800/60"
                  >
                    {cue}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70">
        <div className="flex items-center gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Mapping helper</p>
          <StatusPill status="enabled" label="Deterministic" />
        </div>
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Classify roles with title + skills only</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          src/lib/learning/roleFamilyClassifier.ts maps a job to its family without LLMs. It weighs title keywords three times more than skills and falls back to tenant defaults when no cues appear.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          {classifierSignals.map((signal) => (
            <div
              key={signal.title}
              className="space-y-3 rounded-2xl border border-indigo-100 bg-white/90 p-4 shadow-sm dark:border-indigo-800 dark:bg-zinc-900/80"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{signal.title}</h3>
                <span className="rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-900/60 dark:text-indigo-200 dark:ring-indigo-800/60">
                  Signals
                </span>
              </div>
              <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
                {signal.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70">
        <div className="flex items-center gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Learning signals</p>
          <StatusPill status="healthy" label="Live telemetry" />
        </div>
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Aggregate what we learn per family</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Each family carries its best-performing preset, typical shortlist size, and the post-processing steps Explain and Confidence should use by default.
        </p>

        <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-white/90 shadow-sm dark:border-indigo-800 dark:bg-zinc-900/80">
          <div className="hidden grid-cols-4 gap-4 border-b border-indigo-100 bg-indigo-50/60 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-700 md:grid dark:border-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200">
            <span>Role family</span>
            <span>Best-performing presets</span>
            <span>Typical shortlist size</span>
            <span>Post-processing by family</span>
          </div>
          <div className="divide-y divide-indigo-100 dark:divide-indigo-800">
            {roleSignals.map((signal) => (
              <div key={signal.family} className="grid gap-4 px-4 py-4 md:grid-cols-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-200">{signal.family}</p>
                  <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">{signal.family} roles</p>
                </div>
                <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">{signal.preset}</p>
                <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">{signal.shortlist}</p>
                <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">{signal.postProcessing}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70">
        <div className="flex items-center gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Defaults and controls</p>
          <StatusPill status="enabled" label="Ready for rollout" />
        </div>
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Use role family defaults everywhere they matter</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">New jobs get smart defaults automatically, recruiters see advisory shortlists, and admins keep override controls visible for audits.</p>

        <div className="grid gap-4 md:grid-cols-2">
          {defaultBehaviors.map((block) => (
            <div
              key={block.title}
              className="space-y-3 rounded-2xl border border-indigo-100 bg-white/90 p-4 shadow-sm dark:border-indigo-800 dark:bg-zinc-900/80"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{block.title}</h3>
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-100 dark:ring-emerald-800/60">
                  {block.tag}
                </span>
              </div>
              <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </ETEClientLayout>
  );
}
