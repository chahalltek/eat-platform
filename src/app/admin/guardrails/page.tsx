import Link from "next/link";

import { BoltIcon, BeakerIcon, WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/solid";

import { ETECard } from "@/components/ETECard";
import { ETEClientLayout } from "@/components/ETEClientLayout";
import { canManageFeatureFlags } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/user";
import { getCurrentTenantId } from "@/lib/tenant";
import { getTenantMode } from "@/lib/tenantMode";

import { GuardrailsPresetPanel } from "./GuardrailsPresetPanel";
import { SystemModePanel } from "./SystemModePanel";

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
      <ETEClientLayout>
        <ETECard className="mx-auto max-w-4xl border-amber-200 bg-amber-50 text-amber-900">
          <h1 className="text-xl font-semibold">Admin access required</h1>
          <p className="mt-2 text-sm">
            You need an admin role to manage guardrails presets. Switch to an admin user to continue.
          </p>
          <div className="mt-4">
            <Link href="/" className="text-sm font-medium underline">
              Return to home
            </Link>
          </div>
        </ETECard>
      </ETEClientLayout>
    );
  }

  const initialMode = await getTenantMode();
  const tenantId = await getCurrentTenantId();

  return (
    <ETEClientLayout>
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

        <section className="space-y-5 rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Ops console</p>
              <h2 className="text-xl font-semibold text-zinc-900">Deep links</h2>
              <p className="text-sm text-zinc-600">
                Jump directly into Ops Console tools to validate guardrails and runtime behavior.
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              Guardrails ops
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                label: "Open Test Runner",
                description: "Validate guardrail behavior against the latest E2E scenarios.",
                href: "/admin/ete/tests",
                icon: <BeakerIcon className="h-6 w-6" aria-hidden />,
              },
              {
                label: "Open Runtime Controls",
                description: "Triage feature flags and runtime protections for incidents.",
                href: "/admin/feature-flags",
                icon: <BoltIcon className="h-6 w-6" aria-hidden />,
              },
              {
                label: "Open Diagnostics",
                description: "Inspect tenant diagnostics, guardrail previews, and health signals.",
                href: `/admin/tenant/${tenantId}/diagnostics`,
                icon: <WrenchScrewdriverIcon className="h-6 w-6" aria-hidden />,
              },
            ].map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="group flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                  {link.icon}
                </span>
                <div className="space-y-2">
                  <p className="text-base font-semibold text-zinc-900">{link.label}</p>
                  <p className="text-sm text-zinc-600">{link.description}</p>
                </div>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 transition group-hover:text-indigo-700">
                  Launch
                  <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <SystemModePanel initialMode={initialMode} />

        <GuardrailsPresetPanel initialConfig={DEFAULT_GUARDRAIL_CONFIG} />
      </div>
    </ETEClientLayout>
  );
}
