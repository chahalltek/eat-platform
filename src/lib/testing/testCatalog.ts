export type TestCatalogItem = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  localCommand: string;
  ciStep?: string;
  slackSnippet?: string;
  blockedInVercel?: boolean;
};

const TESTS: TestCatalogItem[] = [
  {
    id: "unit-coverage-sweep",
    title: "Unit coverage sweep",
    description: "Runs the full Vitest suite with coverage to guard core ETE services and shared utilities.",
    tags: ["unit", "coverage", "ci"],
    localCommand: "npm run test -- --coverage",
    ciStep: "- name: Unit coverage\n  run: npm run test -- --coverage",
    slackSnippet: "*Unit coverage sweep* — run locally with `npm run test -- --coverage` and mirror in CI with `- name: Unit coverage`",
    blockedInVercel: true,
  },
  {
    id: "config-safety",
    title: "Config and safety rails",
    description: "Validates configuration schemas, client import rules, and security guardrails used by the admin surface.",
    tags: ["ci", "safety", "config"],
    localCommand: "npm run ci:config-validate && npm run ci:client-import-guard && npm run ci:security-baseline",
    ciStep:
      "- name: Config and safety rails\n  run: |\n    npm run ci:config-validate\n    npm run ci:client-import-guard\n    npm run ci:security-baseline",
    slackSnippet:
      "*Config and safety rails* — local: `npm run ci:config-validate && npm run ci:client-import-guard && npm run ci:security-baseline`\nCI: `- name: Config and safety rails`",
    blockedInVercel: true,
  },
  {
    id: "mvp-verification",
    title: "ETE MVP verification pack",
    description: "End-to-end verification of the MVP contract, including agent run logs and tenant diagnostics.",
    tags: ["mvp", "end-to-end", "verification"],
    localCommand: "npm run verify:mvp",
    ciStep: "- name: Verify MVP contract\n  run: npm run verify:mvp",
    slackSnippet: "*ETE MVP verification pack* — run locally with `npm run verify:mvp` or attach to CI via `- name: Verify MVP contract`",
    blockedInVercel: true,
  },
  {
    id: "mvp-smoke",
    title: "MVP smoke checklist",
    description: "Fast smoke path that exercises the highest-signal MVP scenarios before deploy windows.",
    tags: ["smoke", "mvp", "fast"],
    localCommand: "npm run verify:mvp:smoke",
    ciStep: "- name: MVP smoke\n  run: npm run verify:mvp:smoke",
    slackSnippet: "*MVP smoke checklist* — local command `npm run verify:mvp:smoke`; GH Actions step `- name: MVP smoke`",
    blockedInVercel: true,
  },
  {
    id: "admin-listing-auth",
    title: "Admin listing endpoint auth",
    description: "Ensures tenant scoping is enforced for the admin listing endpoint, covering auth headers and rejection paths.",
    tags: ["ete", "auth", "api"],
    localCommand: "npm run ete:auth -- --scope admin-listing",
    ciStep: "- name: Admin listing endpoint auth\n  run: npm run ete:auth -- --scope admin-listing",
    slackSnippet: "*Admin listing endpoint auth* — `npm run ete:auth -- --scope admin-listing` (share results back in-thread)",
  },
  {
    id: "catalog-registry",
    title: "ETE catalog registry export",
    description: "Snapshot of the current ETE catalog registry to make sure CI uses the latest curated scenarios.",
    tags: ["ete", "ops", "catalog"],
    localCommand: "npm run ete:catalog",
    ciStep: "- name: ETE catalog registry\n  run: npm run ete:catalog",
    slackSnippet: "*ETE catalog registry export* — `npm run ete:catalog` locally; CI step `- name: ETE catalog registry`",
  },
];

export function getETEAdminTestCatalog(): TestCatalogItem[] {
  return TESTS;
}

export function getTenantTestRunnerCatalog(): TestCatalogItem[] {
  return TESTS;
}
