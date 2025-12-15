export type TestCatalogItem = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  localTestCommand: string;
  ciSnippet: string;
  blockedInVercel: boolean;
};

export function getETEAdminTestCatalog(): TestCatalogItem[] {
  return [
    {
      id: "unit-coverage-sweep",
      title: "Unit coverage sweep",
      description: "Runs the full Vitest suite with coverage to guard core ETE services and shared utilities.",
      tags: ["unit", "coverage", "vitest"],
      localTestCommand: "npm run test:coverage",
      ciSnippet: "- name: Unit coverage\n  run: npm run test:coverage",
      blockedInVercel: true,
    },
    {
      id: "mvp-verification",
      title: "ETE MVP verification pack",
      description: "End-to-end verification of the MVP contract, including agent run logs and tenant diagnostics.",
      tags: ["mvp", "end-to-end", "verification"],
      localTestCommand: "npm run verify:mvp",
      ciSnippet: "- name: Verify MVP contract\n  run: npm run verify:mvp",
      blockedInVercel: true,
    },
    {
      id: "mvp-smoke",
      title: "MVP smoke checklist",
      description: "Fast smoke path that exercises the highest-signal MVP scenarios before deploy windows.",
      tags: ["smoke", "mvp", "fast"],
      localTestCommand: "npm run verify:mvp:smoke",
      ciSnippet: "- name: MVP smoke\n  run: npm run verify:mvp:smoke",
      blockedInVercel: true,
    },
    {
      id: "config-safety",
      title: "Config and safety rails",
      description: "Validates configuration schemas, client import rules, and security guardrails used by the admin surface.",
      tags: ["ci", "safety", "config"],
      localTestCommand: "npm run ci:config-validate && npm run ci:client-import-guard && npm run ci:security-baseline",
      ciSnippet:
        "- name: Config and safety rails\n  run: |\n    npm run ci:config-validate\n    npm run ci:client-import-guard\n    npm run ci:security-baseline",
      blockedInVercel: true,
    },
  ];
}
