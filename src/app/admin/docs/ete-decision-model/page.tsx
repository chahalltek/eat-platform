import fs from "node:fs/promises";
import path from "node:path";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { BackToConsoleButton } from "@/components/BackToConsoleButton";
import { isAdminOrDataAccessRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/user";

export const dynamic = "force-static";

async function loadDecisionModelDoc() {
  const docPath = path.join(process.cwd(), "docs", "ete", "ETE_DECISION_MODEL.md");

  try {
    return await fs.readFile(docPath, "utf8");
  } catch (error) {
    console.error("Unable to read ETE decision model doc", error);
    return null;
  }
}

export default async function ETEDecisionModelDocsPage() {
  const user = await getCurrentUser();

  if (!isAdminOrDataAccessRole(user?.role)) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-4 flex justify-end">
          <BackToConsoleButton />
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5 text-amber-900 shadow-sm">
          <h1 className="text-xl font-semibold">Admin access required</h1>
          <p className="mt-2 text-sm text-amber-800">
            You need an admin or data access role to view the ETE decision model documentation.
          </p>
        </div>
      </div>
    );
  }

  const content = await loadDecisionModelDoc();

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 via-white to-indigo-50/40 text-zinc-900 dark:from-black dark:via-zinc-950 dark:to-zinc-900 dark:text-zinc-50">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-12 sm:px-10">
        <div className="flex justify-end">
          <BackToConsoleButton />
        </div>

        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">Admin</p>
          <h1 className="text-3xl font-semibold">ETE decision model</h1>
          <p className="max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
            Server-rendered view of the ETE decision model reference so admins can review the rubric without leaving the
            platform.
          </p>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {content ? (
            <div className="prose prose-slate max-w-none dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          ) : (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Document unavailable</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                We couldn&apos;t find docs/ete/ETE_DECISION_MODEL.md in this build. Confirm the file exists in the
                repository to render it here.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
