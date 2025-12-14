import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/systemMode", () => ({
  getSystemMode: vi.fn(async () => ({
    mode: "production",
    metadata: {},
    guardrailsPreset: "most-restricted",
    agentEnablement: { basic: true, shortlist: true, agents: true },
  })),
}));

vi.mock("@/lib/featureFlags", () => ({
  isFeatureEnabledForTenant: vi.fn(),
}));

vi.mock("@/lib/tenant", () => ({
  getCurrentTenantId: vi.fn(async () => "tenant-123"),
}));

import { isFeatureEnabledForTenant } from "@/lib/featureFlags";
import { assertAgentEnabled, getAgentAvailability } from "./availability";

describe("getAgentAvailability", () => {
  const mockIsFeatureEnabledForTenant = vi.mocked(isFeatureEnabledForTenant);

  beforeEach(() => {
    mockIsFeatureEnabledForTenant.mockResolvedValue(false);
  });

  it("returns system mode enablement when Fire Drill flag is off", async () => {
    const availability = await getAgentAvailability();

    expect(availability.mode.mode).toBe("production");
    expect(availability.confidenceEnabled).toBe(true);
    expect(availability.explainEnabled).toBe(true);
    expect(availability.shortlistEnabled).toBe(true);
  });

  it("forces Fire Drill posture when flag is enabled", async () => {
    mockIsFeatureEnabledForTenant.mockResolvedValueOnce(true);

    const availability = await getAgentAvailability();

    expect(availability.mode.mode).toBe("fire_drill");
    expect(availability.mode.guardrailsPreset).toBe("conservative");
    expect(availability.confidenceEnabled).toBe(false);
    expect(availability.explainEnabled).toBe(false);
    expect(availability.shortlistEnabled).toBe(false);
  });
});

describe("assertAgentEnabled", () => {
  const mockIsFeatureEnabledForTenant = vi.mocked(isFeatureEnabledForTenant);

  beforeEach(() => {
    mockIsFeatureEnabledForTenant.mockResolvedValue(false);
  });

  it("throws when Fire Drill mode disables requested agent", async () => {
    mockIsFeatureEnabledForTenant.mockResolvedValueOnce(true);

    await expect(() => assertAgentEnabled("explainEnabled", "Explain paused"))
      .rejects.toThrowError("Explain paused");
  });
});
