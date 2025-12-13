import Link from "next/link";

import { ETEClientLayout } from "@/components/ETEClientLayout";

export function ExecAccessDenied() {
  return (
    <ETEClientLayout>
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-xl font-semibold">Access limited to execs and admins</h1>
          <p className="mt-2 text-sm text-amber-800">
            Executive intelligence, benchmarks, and copilot access are reserved for executive and admin roles in your tenant.
          </p>
          <div className="mt-4">
            <Link href="/" className="text-sm font-medium text-amber-900 underline">
              Return to home
            </Link>
          </div>
        </div>
      </main>
    </ETEClientLayout>
  );
}
