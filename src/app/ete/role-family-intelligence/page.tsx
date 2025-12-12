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
    cues: ["Portfolio links", "SQL + stats", "Business partnering"],
  },
  {
    name: "Product",
    description: "Product management and design-adjacent roles with emphasis on narratives and outcomes.",
    cues: ["Roadmaps", "PRDs", "Cross-functional proof"],
  },
  {
    name: "Sales",
    description: "Quota-carrying and GTM roles where ramp and territory context matter most.",
    cues: ["Pipeline health", "Win stories", "Ramp speed"],
  },
  {
    name: "Ops",
    description: "People, finance, and business operations roles focused on repeatability and controls.",
    cues: ["Process rigor", "System access", "Metrics hygiene"],
  },
  {
    name: "Custom",
    description: "Tenant-defined families that bundle niche behaviors (e.g., healthcare, hardware, or regional nuances).",
    cues: ["Tenant presets", "Guardrail overrides", "Localized signals"],
  },
];

const roleSignals = [
  {
    family: "Engineering",
    preset: "Skill-forward presets and heavier penalties for missing must-haves.",
    confidence: "Tighter confidence bands clustered in HIGH/MED for staffed roles; flag LOW when resumes are thin.",
    scarcity: "Scarcity triggers when fewer than 5 qualified matches are found after must-have filtering.",
  },
  {
    family: "Data",
    preset: "Blend technical weights with stakeholder keywords so hybrid IC/lead roles are differentiated.",
    confidence: "Medium bands are common; HIGH requires SQL + experimentation evidence.",
    scarcity: "Watch for missing portfolio links or metrics; prompt to enrich before MATCH reruns.",
  },
  {
    family: "Product",
    preset: "Outcome-first presets that boost strategy signals and narrative clarity.",
    confidence: "Wide spread; Explain leans on shipped features and north-star metrics to justify bands.",
    scarcity: "Scarcity pattern is weak data on outcomes—surface guardrails to request artifacts.",
  },
  {
    family: "Sales",
    preset: "Quota attainment and territory context presets with stricter recency decay.",
    confidence: "Confidence bands skew MED/LOW until win stories or pipeline screenshots are present.",
    scarcity: "Trigger overlays when OTE / segment info is missing; recommend admin-presets per segment.",
  },
  {
    family: "Ops",
    preset: "Process-control presets that emphasize systems experience and repeatability.",
    confidence: "Stable MED/HIGH bands when certifications + system access are documented.",
    scarcity: "Scarcity flags when compliance or finance controls are absent from resumes.",
  },
  {
    family: "Custom",
    preset: "Tenant-specific presets pull from saved templates; defaults fall back to nearest core family.",
    confidence: "Confidence distributions mirror the mapped family until tenant-level data matures.",
    scarcity: "Uses tenant telemetry to learn scarcity thresholds; starts with conservative prompts.",
  },
];

const defaultBehaviors = [
  {
    title: "Smart defaults on new jobs",
    items: [
      "Job intake tags each role with a family and loads the matching preset (weights, cutoffs, narratives).",
      "Confidence and Explain seed their prompts with the family’s typical distributions to avoid cold starts.",
      "Scarcity monitors trigger automatically using family thresholds so recruiters see gaps early.",
    ],
  },
  {
    title: "Admin overrides",
    items: [
      "Admins can swap the family preset or pin a custom tenant-defined family when edge cases appear.",
      "Overrides cascade to MATCH, CONFIDENCE, and Explain prompts without editing the job description.",
      "Guardrail presets stay visible so auditors understand which family logic was in play.",
    ],
  },
];

export default function RoleFamilyIntelligencePage() {
  return (
    <ETEClientLayout maxWidthClassName="max-w-6xl" contentClassName="space-y-10">
      <section className="overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-6 shadow-sm dark:border-indigo-900/40 dark:from-indigo-950/60 dark:via-zinc-950 dark:to-emerald-950/40">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">ETE-LEARN-1202</p>
            <h1 className="text-4xl font-semibold leading-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">Role family intelligence</h1>
            <p className="max-w-3xl text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
              Different roles behave differently. This plan introduces role families, aggregates the learning signals that matter, and applies them as smart defaults for recruiters and admins.
            </p>
          </div>
          <ClientActionLink href="/">Back to Console</ClientActionLink>
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70">
        <div className="flex items-center gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Role families</p>
          <StatusPill status="enabled">Tenant-aware</StatusPill>
        </div>
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Introduce the role families we learn from</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">Engineering, Data, Product, Sales, Ops, and Custom (tenant-defined) give us predictable patterns without losing flexibility.</p>

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
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Learning signals</p>
          <StatusPill status="healthy">Live telemetry</StatusPill>
        </div>
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Aggregate what we learn per family</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Every family tracks best-performing presets, typical confidence distributions, and scarcity patterns so recruiters can react without trial-and-error.
        </p>

        <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-white/90 shadow-sm dark:border-indigo-800 dark:bg-zinc-900/80">
          <div className="hidden grid-cols-4 gap-4 border-b border-indigo-100 bg-indigo-50/60 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-700 md:grid dark:border-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200">
            <span>Role family</span>
            <span>Best-performing presets</span>
            <span>Confidence distributions</span>
            <span>Scarcity patterns</span>
          </div>
          <div className="divide-y divide-indigo-100 dark:divide-indigo-800">
            {roleSignals.map((signal) => (
              <div key={signal.family} className="grid gap-4 px-4 py-4 md:grid-cols-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-200">{signal.family}</p>
                  <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">{signal.family} roles</p>
                </div>
                <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">{signal.preset}</p>
                <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">{signal.confidence}</p>
                <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">{signal.scarcity}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70">
        <div className="flex items-center gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Defaults and controls</p>
          <StatusPill status="enabled">Ready for rollout</StatusPill>
        </div>
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Use role family defaults everywhere they matter</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">New jobs get smart defaults automatically, and admins keep override controls visible for audits.</p>

        <div className="grid gap-4 md:grid-cols-2">
          {defaultBehaviors.map((block) => (
            <div
              key={block.title}
              className="space-y-3 rounded-2xl border border-indigo-100 bg-white/90 p-4 shadow-sm dark:border-indigo-800 dark:bg-zinc-900/80"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{block.title}</h3>
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-100 dark:ring-emerald-800/60">
                  Defaults
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
