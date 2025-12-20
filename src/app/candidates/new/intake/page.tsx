import Link from "next/link";

import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { getCurrentUser, getUserTenantId } from "@/lib/auth/user";
import { normalizeRole, USER_ROLES, type UserRole } from "@/lib/auth/roles";
import { FEATURE_FLAGS, isEnabled } from "@/lib/featureFlags";
import { BackToConsoleButton } from "@/components/BackToConsoleButton";

import CandidateIntakeClient from "./Client";

const recruiterRoles = new Set<UserRole>([
  USER_ROLES.ADMIN,
  USER_ROLES.SYSTEM_ADMIN,
  USER_ROLES.MANAGER,
  USER_ROLES.RECRUITER,
  USER_ROLES.SOURCER,
]);

export const metadata = {
  title: "Candidate Intake",
};

export default async function CandidateIntakePage() {
  const [user, tenantId] = await Promise.all([getCurrentUser(), getUserTenantId()]);

  const normalizedRole = normalizeRole(user?.role);
  const resolvedTenantId = (tenantId ?? user?.tenantId ?? DEFAULT_TENANT_ID).trim();
  const showSopLink = await isEnabled(resolvedTenantId, FEATURE_FLAGS.SOP_CONTEXTUAL_LINKS);

  if (!user || !normalizedRole || !recruiterRoles.has(normalizedRole)) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-4 flex justify-end">
          <BackToConsoleButton />
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-sm">
          <h1 className="text-xl font-semibold">Restricted access</h1>
          <p className="mt-2 text-sm text-amber-800">
            Candidate intake is limited to recruiter roles. Switch to an account with recruiter access to continue.
          </p>
          <div className="mt-4 flex gap-4 text-sm font-medium text-amber-900 underline">
            <BackToConsoleButton />
            <Link href="/candidates">View candidates</Link>
          </div>
        </div>
      </div>
    );
  }

  return <CandidateIntakeClient tenantId={resolvedTenantId} showSopLink={showSopLink} />;
}
