<<<<<<< ours
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
=======
import { ETEClientLayout } from "@/components/ETEClientLayout";
import { NotAuthorized } from "@/components/NotAuthorized";
import { can } from "@/lib/auth/permissions";
import { getCurrentUser, getUserClaims } from "@/lib/auth/identityProvider";

import { FulfillmentContent } from "./FulfillmentContent";

export const dynamic = "force-dynamic";

export default async function FulfillmentPage() {
  const [user, claims] = await Promise.all([getCurrentUser(), getUserClaims()]);
  const permissionSubject = user ?? claims;

  if (!can(permissionSubject, "fulfillment.view")) {
    return (
      <ETEClientLayout maxWidthClassName="max-w-5xl">
        <div className="py-10">
          <NotAuthorized
            title="Not authorized"
            message="You need fulfillment.view permissions to access this page."
          />
        </div>
      </ETEClientLayout>
    );
  }

  const canPublish = can(permissionSubject, "agent.run.match");

  return (
    <ETEClientLayout maxWidthClassName="max-w-5xl" contentClassName="py-10">
      <FulfillmentContent canPublish={canPublish} />
    </ETEClientLayout>
  );
>>>>>>> theirs
}
