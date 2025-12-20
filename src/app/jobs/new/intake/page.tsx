import { isEnabled, FEATURE_FLAGS } from "@/lib/featureFlags";
import { getCurrentTenantId } from "@/lib/tenant";

import JobIntakeClient from "./Client";

export default async function JobIntakePage() {
  const tenantId = await getCurrentTenantId();
  const showSopLink = await isEnabled(tenantId, FEATURE_FLAGS.SOP_CONTEXTUAL_LINKS);

  return <JobIntakeClient showSopLink={showSopLink} />;
}

