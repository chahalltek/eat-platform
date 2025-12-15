import { ETEClientLayout } from "@/components/ETEClientLayout";
import { canManageFeatureFlags } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/user";

import { AdminEteTestsClient } from "./AdminEteTestsClient";

export const dynamic = "force-dynamic";

const QUICK_COMMANDS = [
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

const TEST_CATALOG = [
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

function AccessDenied() {
  return (
    <ETEClientLayout showFireDrillBanner={false}>
      <div className="mx-auto max-w-4xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h1 className="text-xl font-semibold">Admins only</h1>
        <p className="mt-2 text-sm text-amber-800">
          You need an admin role to view the ETE on-demand test catalog. Switch to an admin user to continue.
        </p>
      </div>
    </ETEClientLayout>
  );
}

export default async function AdminEteTestsPage() {
  const user = await getCurrentUser();

  if (!canManageFeatureFlags(user)) {
    return <AccessDenied />;
  }

  return (
    <ETEClientLayout showFireDrillBanner={false}>
      <AdminEteTestsClient quickCommands={QUICK_COMMANDS} tests={TEST_CATALOG} isVercelLimited={Boolean(process.env.VERCEL)} />
    </ETEClientLayout>
  );
}
