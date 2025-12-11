import Link from "next/link";

import { EATCard } from "@/components/EATCard";
import { EATClientLayout } from "@/components/EATClientLayout";
import { canManageFeatureFlags } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/user";

import { GuardrailsPresetPanel } from "./GuardrailsPresetPanel";

export const dynamic = "force-dynamic";

const DEFAULT_GUARDRAIL_CONFIG = {
  preset: "Balanced" as const,
  scoringMode: "auto (Prefer blocks)",
  modelId: "anthropic/claude-3-sonnet",
  scoringEndpoint: "https://guardian.eat.local/scoring",
  guardrailRules: "Block dangerous requests, respect privacy constraints, and require clear consent reminders.",
  ruleSupport: "Enforce guardrail rules",
  safetyLevel: "Prefer blocks",
  maxInputTokens: 2000,
  maxOutputTokens: 600,
};

export default async function GuardrailsAdminPage() {
  const user = await getCurrentUser();

  if (!canManageFeatureFlags(user)) {
    return (
      <EATClientLayout>
        <EATCard className="mx-auto max-w-4xl border-amber-200 bg-amber-50 text-amber-900">
          <h1 className="text-xl font-semibold">Admin access required</h1>
          <p className="mt-2 text-sm">
            You need an admin role to manage guardrails presets. Switch to an admin user to continue.
          </p>
          <div className="mt-4">
            <Link href="/" className="text-sm font-medium underline">
              Return to home
            </Link>
          </div>
        </EATCard>
      </EATClientLayout>
    );
  }

  return (
    <EATClientLayout>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Admin</p>
            <h1 className="text-3xl font-semibold text-zinc-900">Guardrails control</h1>
            <p className="text-sm text-zinc-600">
              Choose presets and tune platform guardrails before activating them for production.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700"
          >
            Back to home
          </Link>
        </header>

        <GuardrailsPresetPanel initialConfig={DEFAULT_GUARDRAIL_CONFIG} />
      </div>
    </EATClientLayout>
  );
}
