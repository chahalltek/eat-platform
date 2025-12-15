export type AdminTestCatalogItem = {
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

export type AdminTestQuickCommand = {
  id: string;
  title: string;
  bulletPoints: string[];
  command: string;
};

const QUICK_COMMANDS: AdminTestQuickCommand[] = [
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

const TEST_CATALOG: AdminTestCatalogItem[] = [
  {
    id: "discipline-candidate-experience",
    title: "Discipline candidate experience",
    description: "Validates the candidate landing page and profile journey used for quick model comparisons across disciplines.",
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
];

export function getAdminTestingCatalog() {
  return {
    quickCommands: QUICK_COMMANDS,
    tests: TEST_CATALOG,
  } as const;
}
