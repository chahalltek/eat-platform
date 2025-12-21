export type ImpactClass = "HALTS" | "DEGRADES" | "BLOCKS" | "ISOLATED" | "FAILS CLOSED";

export type OpsImpactOverlay = {
  impactClass: ImpactClass;
  headline: string;
  impacts: string[];
};

export const impactClassStyles: Record<
  ImpactClass,
  { badge: string; accentDot: string; border: string; text: string }
> = {
  HALTS: {
    badge: "bg-red-50/80 text-red-800 ring-red-200 dark:bg-red-900/30 dark:text-red-100 dark:ring-red-800/70",
    accentDot: "bg-red-500",
    border: "border-red-100 dark:border-red-900/50",
    text: "text-red-900 dark:text-red-50",
  },
  "FAILS CLOSED": {
    badge:
      "bg-amber-50/80 text-amber-800 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:ring-amber-800/70",
    accentDot: "bg-amber-500",
    border: "border-amber-100 dark:border-amber-900/50",
    text: "text-amber-900 dark:text-amber-50",
  },
  DEGRADES: {
    badge:
      "bg-yellow-50/80 text-yellow-800 ring-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-100 dark:ring-yellow-800/70",
    accentDot: "bg-yellow-500",
    border: "border-yellow-100 dark:border-yellow-900/50",
    text: "text-yellow-900 dark:text-yellow-50",
  },
  BLOCKS: {
    badge:
      "bg-blue-50/80 text-blue-800 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-100 dark:ring-blue-800/70",
    accentDot: "bg-blue-500",
    border: "border-blue-100 dark:border-blue-900/50",
    text: "text-blue-900 dark:text-blue-50",
  },
  ISOLATED: {
    badge:
      "bg-emerald-50/80 text-emerald-800 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-100 dark:ring-emerald-800/70",
    accentDot: "bg-emerald-500",
    border: "border-emerald-100 dark:border-emerald-900/50",
    text: "text-emerald-900 dark:text-emerald-50",
  },
};

export const opsImpactOverlayByNodeId: Partial<Record<string, OpsImpactOverlay>> = {
  rua: {
    impactClass: "HALTS",
    headline: "Role structure halts until clarity is restored.",
    impacts: [
      "New job intake cannot be structured.",
      "Matching and scoring do not run.",
      "Hiring decisions halt until role clarity is restored.",
    ],
  },
  rina: {
    impactClass: "BLOCKS",
    headline: "New candidate intake is blocked at normalization.",
    impacts: [
      "New resumes cannot be normalized.",
      "Existing normalized candidates remain usable.",
      "Matching for new candidates is blocked.",
    ],
  },
  scoring: {
    impactClass: "HALTS",
    headline: "No new rankings or shortlists are produced.",
    impacts: [
      "No new rankings are produced.",
      "Existing scores are not reused.",
      "Shortlists and recommendations halt.",
    ],
  },
  confidence: {
    impactClass: "FAILS CLOSED",
    headline: "Decisions stop to avoid unreviewed judgment.",
    impacts: [
      "Decisions cannot be explained or defended.",
      "Scores may exist but are treated as unsafe.",
      "System fails closed to prevent undocumented judgment.",
    ],
  },
  ats: {
    impactClass: "DEGRADES",
    headline: "External sync pauses; manual intake still works.",
    impacts: [
      "External jobs and candidates stop syncing.",
      "Manual intake and resume uploads still work.",
      "Downstream agents continue with existing data.",
    ],
  },
  adapter: {
    impactClass: "DEGRADES",
    headline: "External sync pauses; manual intake still works.",
    impacts: [
      "External jobs and candidates stop syncing.",
      "Manual intake and resume uploads still work.",
      "Downstream agents continue with existing data.",
    ],
  },
  database: {
    impactClass: "HALTS",
    headline: "Core record-keeping is unavailable; matching stops.",
    impacts: [
      "Profiles, scores, and history are unavailable.",
      "Matching and scoring halt immediately.",
      "No decisions can be executed safely.",
    ],
  },
  "agent-sync": {
    impactClass: "FAILS CLOSED",
    headline: "Fan-out pauses to avoid partial decisions.",
    impacts: [
      "Agent runs do not fan out.",
      "Partial results may exist but are incomplete.",
      "System pauses to avoid partial decisions.",
    ],
  },
  diagnostics: {
    impactClass: "DEGRADES",
    headline: "Troubleshooting visibility degrades but processing continues.",
    impacts: [
      "Decisions still run.",
      "Root cause analysis becomes limited.",
      "Post-incident accountability is reduced.",
    ],
  },
  "tenant-config": {
    impactClass: "FAILS CLOSED",
    headline: "Tuning is frozen; execution halts or defaults apply.",
    impacts: [
      "Behavior cannot be tuned or corrected.",
      "Defaults apply or execution halts.",
      "Operators lose ability to intervene safely.",
    ],
  },
  "feature-flags": {
    impactClass: "FAILS CLOSED",
    headline: "Gates default to safety; risky paths block.",
    impacts: [
      "Feature gating is unavailable.",
      "Risky paths are blocked by default.",
      "System prioritizes safety over availability.",
    ],
  },
  "runtime-controls": {
    impactClass: "FAILS CLOSED",
    headline: "Failsafes unavailable; system halts for safety.",
    impacts: [
      "Kill switch and safety modes are unavailable.",
      "System halts rather than proceed unsafely.",
      "Manual intervention required.",
    ],
  },
};
