<<<<<<< ours
import { redirect } from "next/navigation";

import { normalizeSearchParamValue, resolveDeepLinkDestination } from "@/lib/routing/deepLink";

type FulfillmentPageProps = {
  searchParams?: {
    jobId?: string | string[];
    candidateId?: string | string[];
    from?: string | string[];
    returnUrl?: string | string[];
  };
};

export default function FulfillmentPage({ searchParams }: FulfillmentPageProps) {
  const destination = resolveDeepLinkDestination({
    jobId: normalizeSearchParamValue(searchParams?.jobId),
    candidateId: normalizeSearchParamValue(searchParams?.candidateId),
    from: normalizeSearchParamValue(searchParams?.from),
    returnUrl: normalizeSearchParamValue(searchParams?.returnUrl),
  });

  redirect(destination);
=======
export default function FulfillmentDashboardPage() {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Fulfillment</p>
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
      <p className="text-sm text-slate-600">A central place for fulfillment metrics and actions.</p>
    </section>
  );
>>>>>>> theirs
}
