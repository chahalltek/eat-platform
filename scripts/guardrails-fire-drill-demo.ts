import { FEATURE_FLAGS, resetFeatureFlagCache, setFeatureFlag } from "../src/lib/featureFlags";
import { getAgentAvailability } from "../src/lib/agents/availability";
import { withTenantContext } from "../src/lib/tenant";

async function run() {
  const tenantId = process.env.TENANT_ID ?? "demo";

  await withTenantContext(tenantId, async () => {
    resetFeatureFlagCache();

    await setFeatureFlag(FEATURE_FLAGS.FIRE_DRILL_MODE, false);
    await showStatus("Fire Drill disabled", tenantId);

    await setFeatureFlag(FEATURE_FLAGS.FIRE_DRILL_MODE, true);
    await showStatus("Fire Drill enabled", tenantId);
  });
}

async function showStatus(label: string, tenantId: string) {
  const availability = await getAgentAvailability();

  console.log(
    `${label}: mode=${availability.mode.mode}, guardrailsPreset=${availability.mode.guardrailsPreset}, ` +
      `explain=${availability.explainEnabled}, shortlist=${availability.shortlistEnabled}`,
  );
}

run().catch((error) => {
  console.error("Guardrails demo failed", error);
  process.exit(1);
});
