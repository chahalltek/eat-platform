export type OpsQuickCommand = {
  id: string;
  title: string;
  bulletPoints: string[];
  command: string;
};

export type OpsTestCatalogItem = {
  id: string;
  title: string;
  description: string;
  jobTemplate: string;
  discipline: string;
  command: string;
  ciCadence: string;
  ciStatus: string;
  nightlyStatus?: string;
  notes?: string;
};

const QUICK_COMMANDS: OpsQuickCommand[] = [
  {
    id: "discipline",
    title: "Quick compare per discipline",
    bulletPoints: [
      "Test most-relevant candidate page experience (use to compare models)",
      "Plan: Prospective candidate for role match",
      'Example job: "Legal Advocate"',
    ],
    command: 'npm run ete:tests -- --scenario "discipline-comparison" --job "Legal Advocate"',
  },
  {
    id: "sales",
    title: "Sales pipeline smoke",
    bulletPoints: [
      "Test standard hiring team experience",
      "Plan: Hiring for JM1068",
      'Example job: "Account Executive, AMER"',
    ],
    command: 'npm run ete:tests -- --scenario "jm1068-sales-pipeline" --job "Account Executive, AMER"',
  },
];

const TEST_CATALOG: OpsTestCatalogItem[] = [
  {
    id: "discipline-candidate-experience",
    title: "Discipline candidate experience",
    description:
      "Validates the candidate landing page and profile journey used for quick model comparisons across disciplines.",
    jobTemplate: "Prospective candidate for role match",
    discipline: "Coding",
    command: QUICK_COMMANDS[0].command,
    ciCadence: "3x daily + nightly",
    ciStatus: "Stable across morning, midday, and evening checks.",
    nightlyStatus: "Runs in nightly regression for parity with CI.",
    notes: "Best starting point when comparing model responses for role-matching prompts.",
  },
  {
    id: "pm-role-alignment",
    title: "Product manager role alignment",
    description: "Checks PM-specific intent capture, screening prompts, and drafting workflows for the role match template.",
    jobTemplate: "Prospective candidate for role match",
    discipline: "PM",
    command: 'npm run ete:tests -- --scenario "pm-role-alignment" --job "Product Manager, Platform"',
    ciCadence: "Nightly + on-demand",
    ciStatus: "Nightly coverage with spot checks during releases.",
    notes: "Use this to validate PM-tailored scoring and messaging flows.",
  },
  {
    id: "sales-hiring-workspace",
    title: "Sales hiring workspace coverage",
    description: "Ensures the hiring workspace remains healthy for JM1068 and sales roles, including recap generation.",
    jobTemplate: "Hiring for JM1068",
    discipline: "Sales",
    command: QUICK_COMMANDS[1].command,
    ciCadence: "3x daily + nightly",
    ciStatus: "Included in morning, midday, and evening checks.",
    nightlyStatus: "Included in nightly regression for sales coverage.",
    notes: "Covers the standard hiring team experience for sales recruiters and coordinators.",
  },
  {
    id: "agents.match-route",
    title: "Match agent route contract",
    description: "Validates the /api/agents/match contract for job-to-candidate scoring across tenants.",
    jobTemplate: "Agents routes",
    discipline: "Matching",
    command: "npm run test -- tests/agents/match-route.test.ts",
    ciCadence: "Per change + nightly",
    ciStatus: "Stable for route contract coverage.",
  },
  {
    id: "agents.profile-route",
    title: "Profile agent route",
    description: "Checks profile ingestion, enrichment, and guardrails for the profile endpoint.",
    jobTemplate: "Agents routes",
    discipline: "Profiles",
    command: "npm run test -- tests/agents/profile-api.test.ts",
    ciCadence: "Per change",
    ciStatus: "Covers profile creation and validation paths.",
  },
  {
    id: "agents.intake-route",
    title: "Role intake route",
    description: "Confirms the intake endpoint captures required job data and applies recruiter validation rules.",
    jobTemplate: "Agents routes",
    discipline: "Intake",
    command: "npm run test -- tests/agents/intake-api.test.ts",
    ciCadence: "Per change",
    ciStatus: "Ensures intake paths and recruiter validation remain stable.",
  },
  {
    id: "agents.shortlist-route",
    title: "Shortlist agent route",
    description: "Executes shortlist generation and verifies scoring + confidence thresholds.",
    jobTemplate: "Agents routes",
    discipline: "Shortlist",
    command: "npm run test -- tests/agents/shortlist-api.test.ts",
    ciCadence: "Per change + nightly",
    ciStatus: "Tracks shortlist thresholds and response shape.",
  },
  {
    id: "agents.explain-route",
    title: "Explainability routes",
    description: "Covers explain + shortlist explain flows to keep justification text stable.",
    jobTemplate: "Agents routes",
    discipline: "Explainability",
    command: "npm run test -- tests/agents/explain-shortlist-routes.test.ts",
    ciCadence: "Nightly",
    ciStatus: "Runs with shortlist explain regressions.",
  },
  {
    id: "tenant.guardrails",
    title: "Tenant guardrails + performance",
    description: "Validates guardrail previews and performance reporting for tenant admins.",
    jobTemplate: "Tenant controls",
    discipline: "Guardrails",
    command: "npm run test -- tests/admin/guardrails-performance-api.test.ts tests/admin/tenant-guardrails-page.test.tsx",
    ciCadence: "Per change",
    ciStatus: "Ensures guardrail surfaces stay wired in UI and API.",
  },
  {
    id: "tenant.diagnostics",
    title: "Tenant diagnostics",
    description: "Covers diagnostics builder and API responses consumed by the operations runbook.",
    jobTemplate: "Tenant controls",
    discipline: "Diagnostics",
    command: "npm run test -- src/lib/tenant/diagnostics.test.ts src/app/api/tenant/diagnostics/route.test.ts",
    ciCadence: "Per change + nightly",
    ciStatus: "Used by operations runbook readiness checks.",
  },
  {
    id: "tenant.fire-drill",
    title: "Fire drill + controls",
    description: "Exercises the tenant fire drill flow so operational kill switches stay healthy.",
    jobTemplate: "Tenant controls",
    discipline: "Operational readiness",
    command: "npm run test -- src/app/api/tenant/fire_drill/route.test.ts",
    ciCadence: "Nightly",
    ciStatus: "Smoke coverage for incident procedures.",
  },
  {
    id: "verify.mvp.full",
    title: "verify:mvp full suite",
    description: "Runs the full MVP verification harness and produces the summary artifact.",
    jobTemplate: "Release readiness",
    discipline: "MVP",
    command: "npm run verify:mvp",
    ciCadence: "Release gates",
    ciStatus: "Blocks release until green.",
  },
  {
    id: "verify.mvp.smoke",
    title: "verify:mvp smoke",
    description: "Fast MVP smoke that mirrors the nightly smoke job.",
    jobTemplate: "Release readiness",
    discipline: "MVP",
    command: "npm run verify:mvp:smoke",
    ciCadence: "Nightly",
    ciStatus: "Good parity with nightly smoke.",
  },
  {
    id: "verify.mvp.unit",
    title: "verify:mvp unit contract",
    description: "Unit-level verification targets for diagnostics, run logs, and intent APIs.",
    jobTemplate: "Release readiness",
    discipline: "MVP",
    command: "npm run verify:mvp:unit",
    ciCadence: "Per change",
    ciStatus: "Useful for preflight checks before full harness runs.",
  },
];

export const OPS_TEST_REGISTRY = {
  quickCommands: QUICK_COMMANDS,
  catalog: TEST_CATALOG,
};

export function getOpsTestRegistry() {
  return OPS_TEST_REGISTRY;
}
