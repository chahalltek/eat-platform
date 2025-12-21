import Link from "next/link";

import { isEnabled, FEATURE_FLAGS } from "@/lib/featureFlags";
import { getCurrentTenantId } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth/user";
import { normalizeRole, USER_ROLES, type UserRole } from "@/lib/auth/roles";
import { BackToConsoleButton } from "@/components/BackToConsoleButton";

import JobIntakeClient from "./Client";

const recruiterRoles = new Set<UserRole>([
  USER_ROLES.ADMIN,
  USER_ROLES.SYSTEM_ADMIN,
  USER_ROLES.TENANT_ADMIN,
  USER_ROLES.MANAGER,
  USER_ROLES.RECRUITER,
  USER_ROLES.SOURCER,
  USER_ROLES.FULFILLMENT_RECRUITER,
  USER_ROLES.FULFILLMENT_MANAGER,
  USER_ROLES.FULFILLMENT_SOURCER,
]);

export const metadata = {
  title: "Job Intake",
};

export default async function JobIntakePage() {
  const [user, tenantId] = await Promise.all([getCurrentUser(), getCurrentTenantId()]);
  const normalizedRole = normalizeRole(user?.role);
  const showSopLink = await isEnabled(tenantId, FEATURE_FLAGS.SOP_CONTEXTUAL_LINKS);

  if (!user || !normalizedRole || !recruiterRoles.has(normalizedRole)) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-4 flex justify-end">
          <BackToConsoleButton />
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-sm">
          <h1 className="text-xl font-semibold">Restricted access</h1>
          <p className="mt-2 text-sm text-amber-800">
            Job intake is limited to fulfillment and recruiter roles. Switch to an account with recruiter access to continue.
          </p>
          <div className="mt-4 flex gap-4 text-sm font-medium text-amber-900 underline">
            <BackToConsoleButton />
            <Link href="/jobs">View jobs</Link>
          </div>
        </div>
      </div>
    );
  }

  return <JobIntakeClient showSopLink={showSopLink} />;
}
