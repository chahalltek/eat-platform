import {
  BanknotesIcon,
  BoltIcon,
  BuildingOffice2Icon,
  FunnelIcon,
  ExclamationTriangleIcon,
  PlayCircleIcon,
  ServerStackIcon,
  ShieldCheckIcon,
  SignalIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/user";
import { isAdminOrDataAccessRole, normalizeRole } from "@/lib/auth/roles";
import { getPlatformHealthSnapshot } from "@/lib/metrics/platformHealth";
import { EteLogo } from "@/components/EteLogo";
import { BackToConsoleButton } from "@/components/BackToConsoleButton";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "indigo",
  helper,
}: {
  label: string;
  value: string | number;
  icon: typeof BoltIcon;
  tone?: "indigo" | "emerald" | "amber" | "sky" | "rose";
  helper?: string;
}) {
  const toneMap: Record<"indigo" | "emerald" | "amber" | "sky" | "rose", string> = {
    indigo: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200",
    sky: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-200",
    rose: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200",
  };

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${toneMap[tone]}`}>
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
        <p className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
        {helper ? <p className="text-xs text-zinc-500 dark:text-zinc-400">{helper}</p> : null}
      </div>
    </div>
  );
}

function DataTable({
  title,
  rows,
  empty,
  columns,
}: {
  title: string;
  rows: { label: string; value: string | number }[];
  empty: string;
  columns?: { label: string; value: string };
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{title}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Live snapshot</p>
        </div>
        {columns ? (
          <div className="flex items-center gap-6 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <span>{columns.label}</span>
            <span>{columns.value}</span>
          </div>
        ) : null}
      </div>
      <div className="mt-4 divide-y divide-zinc-100 text-sm text-zinc-700 dark:divide-zinc-800 dark:text-zinc-200">
        {rows.length === 0 ? (
          <p className="py-3 text-zinc-500 dark:text-zinc-400">{empty}</p>
        ) : (
          rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between py-3">
              <span className="font-medium">{row.label}</span>
              <span className="text-base">{row.value}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function formatDate(value: Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default async function AdminHealthPage() {
  const user = await getCurrentUser();
  const detectedRole = normalizeRole(user?.role);

  if (!isAdminOrDataAccessRole(user?.role)) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-4 flex justify-end">
          <BackToConsoleButton />
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5 text-amber-900 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldCheckIcon className="h-6 w-6" aria-hidden />
            <div>
              <h1 className="text-xl font-semibold">Admin access required</h1>
              <p className="mt-1 text-sm text-amber-800">
                Admin routes are locked to privileged roles. You&apos;re currently signed in as{' '}
                <span className="font-semibold">{user?.email ?? "an unknown user"}</span>
                {detectedRole ? (
                  <span className="text-xs font-semibold uppercase tracking-wide"> ({detectedRole})</span>
                ) : null}
                , which doesn&apos;t have admin access for /admin.
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-800">
                <li>Use the seeded admin account (admin@test.demo) and the configured AUTH_PASSWORD.</li>
                <li>
                  If you expected admin access, sign out, sign back in, and confirm your role is ADMIN, SYSTEM_ADMIN,
                  TENANT_ADMIN, or DATA_ACCESS.
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-4">
            <BackToConsoleButton />
          </div>
        </div>
      </div>
    );
  }

  const snapshot = await getPlatformHealthSnapshot();

  return (
    <div
      data-testid="admin-health-page"
      className="min-h-screen bg-gradient-to-b from-zinc-50 via-white to-indigo-50/40 text-zinc-900 dark:from-black dark:via-zinc-950 dark:to-zinc-900 dark:text-zinc-50"
    >
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12 sm:px-10">
        <div className="flex justify-end">
          <BackToConsoleButton />
        </div>
        <div className="flex flex-wrap items-center gap-4 rounded-3xl border border-indigo-100 bg-white/90 p-5 shadow-sm ring-1 ring-white/80 dark:border-indigo-900/50 dark:bg-zinc-900/60">
          <EteLogo variant="horizontal" />
          <div className="text-sm text-zinc-700 dark:text-zinc-300">
            <p className="font-semibold text-zinc-900 dark:text-zinc-50">EDGE Talent Engine™ admin</p>
            <p className="text-xs text-indigo-700 dark:text-indigo-200">Platform controls</p>
          </div>
        </div>

        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">Admin</p>
            <h1 className="text-3xl font-semibold sm:text-4xl">Platform health</h1>
            <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
              Operational visibility across agents, errors, user activity, and infrastructure at a glance.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
            <Link
              href="/admin/cost"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-700 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:text-emerald-800 hover:shadow-lg dark:border-emerald-900/60 dark:bg-zinc-900 dark:text-emerald-200"
            >
              <BanknotesIcon className="h-5 w-5" aria-hidden /> Cost drivers
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-700 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
            >
              <SignalIcon className="h-5 w-5" aria-hidden /> View observability
            </Link>
          </div>
        </header>

        <section className="space-y-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">Control panels</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Jump to the admin tools for tenant operating mode changes and feature flag toggles.
            </p>
          </div>
          <nav data-testid="admin-nav" aria-label="Admin navigation">
            <div className="grid gap-4 md:grid-cols-2">
              <Link
                href="/admin/tenants"
                className="group flex items-start gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">
                  <BuildingOffice2Icon className="h-6 w-6" aria-hidden />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Tenant control center</p>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">Mode & plans</span>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Open tenant profiles to switch between sandbox, pilot, production, or fire drill modes and manage plan settings.
                  </p>
                  <span className="text-sm font-semibold text-indigo-600 transition group-hover:text-indigo-700 dark:text-indigo-300 dark:group-hover:text-indigo-200">
                    Go to tenants
                  </span>
                </div>
              </Link>
              <Link
                href="/admin/feature-flags"
                className="group flex items-start gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                  <FunnelIcon className="h-6 w-6" aria-hidden />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Feature flag control</p>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-100">Toggles</span>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Manage platform flags from a single panel and jump to the tenant diagnostics test panel to validate toggles.
                  </p>
                  <span className="text-sm font-semibold text-indigo-600 transition group-hover:text-indigo-700 dark:text-indigo-300 dark:group-hover:text-indigo-200">
                    Open feature flags
                  </span>
                </div>
              </Link>
              <Link
                href="/admin/ete/tests"
                className="group flex items-start gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-200">
                  <PlayCircleIcon className="h-6 w-6" aria-hidden />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Test Runner</p>
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-800 dark:bg-sky-900/50 dark:text-sky-100">ETE</span>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Launch the EDGE Talent Engine™ test runner to validate admin workflows and guardrails.
                  </p>
                  <span className="text-sm font-semibold text-indigo-600 transition group-hover:text-indigo-700 dark:text-indigo-300 dark:group-hover:text-indigo-200">
                    Open Test Runner
                  </span>
                </div>
              </Link>
            </div>
          </nav>
        </section>

        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Agents" value={snapshot.agents.totalAgents} icon={WrenchScrewdriverIcon} helper="Unique agent names" />
          <StatCard label="Runs (24h)" value={snapshot.runs.last24h} icon={PlayCircleIcon} tone="emerald" helper="Execution volume" />
          <StatCard
            label="Error rate (24h)"
            value={`${snapshot.errors.last24h} failures`}
            icon={ExclamationTriangleIcon}
            tone="amber"
            helper={`${snapshot.runs.successRate}% success`}
          />
          <StatCard label="Total users" value={snapshot.users.total} icon={UserGroupIcon} tone="sky" helper={`${snapshot.users.admins} admins`} />
        </section>

        <section className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Agents</h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Active prompts, busiest agents, and latest deployment activity.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-zinc-600 dark:text-zinc-300">
                  <span className="rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">
                    {snapshot.agents.activePrompts} active prompts
                  </span>
                  <span className="rounded-full bg-zinc-100 px-3 py-1 font-medium text-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-100">
                    Last update: {formatDate(snapshot.agents.latestPromptUpdate)}
                  </span>
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <DataTable
                  title="Busiest agents (7d)"
                  empty="No recent agent activity."
                  rows={snapshot.agents.busiestAgents.map((row) => ({ label: row.agentName, value: `${row.runs} runs` }))}
                />
                <DataTable
                  title="Error leaders (7d)"
                  empty="No failed runs recorded."
                  rows={snapshot.errors.topByAgent.map((row) => ({ label: row.agentName, value: `${row.count} failures` }))}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Runs</h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Execution health over the last 24 hours.</p>
                </div>
                <PlayCircleIcon className="h-6 w-6 text-emerald-500" aria-hidden />
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/60">
                  <p className="text-zinc-500 dark:text-zinc-400">Runs started</p>
                  <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{snapshot.runs.last24h}</p>
                </div>
                <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/60">
                  <p className="text-zinc-500 dark:text-zinc-400">Currently running</p>
                  <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{snapshot.runs.runningNow}</p>
                </div>
                <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/60">
                  <p className="text-zinc-500 dark:text-zinc-400">Avg duration</p>
                  <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                    {snapshot.runs.averageDurationMs ? `${snapshot.runs.averageDurationMs} ms` : "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <DataTable
              title="User activity"
              empty="No user activity in the last week."
              rows={[
                { label: "Admins", value: snapshot.users.admins },
                { label: "Active last week", value: snapshot.users.activeLastWeek },
                { label: "New this month", value: snapshot.users.newThisMonth },
              ]}
            />

            <DataTable
              title="Database health"
              empty="No records present."
              rows={snapshot.database.tables.map((table) => ({ label: table.label, value: table.count }))}
              columns={{ label: "Table", value: "Count" }}
            />

            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Kill switches</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Visibility into service-level kill switches.</p>
                </div>
                <ServerStackIcon className="h-6 w-6 text-sky-500" aria-hidden />
              </div>
              <div className="mt-4 space-y-3 text-sm text-zinc-700 dark:text-zinc-200">
                {snapshot.killSwitches.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-start justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{item.label}</span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {item.state.latched ? `Latched: ${item.state.reason}` : "Active"}
                      </span>
                    </div>
                    <div
                      className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                        item.state.latched
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
                      }`}
                    >
                      <span className="inline-block h-2 w-2 rounded-full bg-current" aria-hidden />
                      {item.state.latched ? "Latched" : "Clear"}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-3">
                <BoltIcon className="h-6 w-6 text-indigo-500" aria-hidden />
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">DB health & retention</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Tenants: {snapshot.database.tables.find((t) => t.label === "Tenants")?.count ?? 0} · Records updated monthly.
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Use this panel to spot imbalances (e.g., runaway outreach or match generation) before they stress the database.
                The counts above refresh live from Prisma so you can validate retention policies and clean-up jobs.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
