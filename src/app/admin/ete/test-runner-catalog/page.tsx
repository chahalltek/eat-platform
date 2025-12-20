import { BoltIcon, CommandLineIcon, LockClosedIcon, ShieldCheckIcon, TagIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

import { EteLogo } from "@/components/EteLogo";
import { ETEClientLayout } from "@/components/ETEClientLayout";
import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { getCurrentTenantId } from "@/lib/tenant";
import { getTenantAdminPageAccess } from "@/lib/tenant/tenantAdminPageAccess";
import { getETEAdminTestCatalog } from "@/lib/testing/testCatalog";

export const dynamic = "force-dynamic";

function AccessDenied() {
  return (
    <ETEClientLayout>
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-xl font-semibold">Admin access required</h1>
          <p className="mt-2 text-sm text-amber-800">
            You need to be a tenant admin for this workspace to view the test runner catalog.
          </p>
          <div className="mt-4">
            <Link href="/" className="text-sm font-medium text-amber-900 underline">
              Back to Console
            </Link>
          </div>
        </div>
      </main>
    </ETEClientLayout>
  );
}

export default async function EteTestRunnerCatalogPage() {
  const tenantId = await getCurrentTenantId();
  const { isAllowed } = await getTenantAdminPageAccess({ tenantId: tenantId ?? DEFAULT_TENANT_ID });

  if (!isAllowed) {
    return <AccessDenied />;
  }

  const catalog = getETEAdminTestCatalog();

  return (
    <ETEClientLayout showFireDrillBanner={false}>
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-6 shadow-sm dark:border-indigo-900/60 dark:from-indigo-950/50 dark:via-zinc-950 dark:to-emerald-950/40">
          <div className="flex flex-col gap-3">
            <EteLogo variant="horizontal" />
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Admin</p>
              <h1 className="text-3xl font-semibold text-zinc-900 sm:text-4xl dark:text-zinc-50">ETE Test Runner Catalog</h1>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                Single source of truth for admin-ready test suites. Run locally, wire into CI, and know which commands are
                blocked in Vercel environments.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-sm">
            <Link
              href="/admin/ete/test-plan"
              className="inline-flex items-center justify-center rounded-full border border-indigo-200 bg-white px-4 py-2 font-semibold text-indigo-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-indigo-50 hover:text-indigo-900 dark:border-indigo-800 dark:bg-zinc-900 dark:text-indigo-100 dark:hover:bg-indigo-800/40"
            >
              Back to Test plan
            </Link>
            <Link
              href="/admin/feature-flags"
              className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 py-2 font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-indigo-500"
            >
              System controls
            </Link>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-2">
          {catalog.map((item) => (
            <article
              key={item.id}
              className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/80"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Test</p>
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{item.title}</h2>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">{item.description}</p>
                </div>
                {item.blockedInVercel ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-50">
                    <LockClosedIcon className="h-4 w-4" />
                    Not available in Vercel
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-100"
                  >
                    <TagIcon className="h-4 w-4" />
                    {tag}
                  </span>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300">
                    <CommandLineIcon className="h-4 w-4" />
                    Local command
                  </div>
                  <code className="block whitespace-pre-wrap font-mono text-sm leading-relaxed">{item.localCommand}</code>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-800 shadow-inner dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300">
                    <ShieldCheckIcon className="h-4 w-4" />
                    CI snippet
                  </div>
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-zinc-800 dark:text-zinc-100">{item.ciStep}</pre>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-3 text-xs font-semibold text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-100">
                <BoltIcon className="h-4 w-4" />
                Keep local runs fast, then wire the same commands into CI for promotion gates.
              </div>
            </article>
          ))}
        </section>
      </div>
    </ETEClientLayout>
  );
}
