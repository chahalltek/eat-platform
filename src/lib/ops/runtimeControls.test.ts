import { describe, expect, test } from "vitest";

import { KILL_SWITCHES, type KillSwitchState } from "@/lib/killSwitch";
import { describeSafetyControls, mapFeatureFlagControl, mapKillSwitchControl } from "./runtimeControls";

describe("runtimeControls contract helpers", () => {
  test("describes safety controls from environment", () => {
    const env = {
      TESTS_DISABLED_IN_THIS_ENVIRONMENT: "true",
      HOSTING_ON_VERCEL: "true",
    } as NodeJS.ProcessEnv;

    const controls = describeSafetyControls(env);

    const statuses = Object.fromEntries(controls.map((control) => [control.id, control.status]));

    expect(statuses["safety.tests-disabled"]).toBe("blocked");
    expect(statuses["safety.hosting-on-vercel"]).toBe("blocked");
  });

  test("maps a kill switch into a control descriptor", () => {
    const state: KillSwitchState = { latched: true, reason: "Maintenance window", latchedAt: new Date("2024-01-01T00:00:00Z") };

    const control = mapKillSwitchControl(KILL_SWITCHES.AGENTS, state, { KILL_SWITCH_AGENTS: "true" });

    expect(control.scope).toBe("environment");
    expect(control.status).toBe("disabled");
    expect(control.reason).toContain("Maintenance");
    expect(control.updatedAt).toBe("2024-01-01T00:00:00.000Z");
  });

  test("maps feature flags into a stable descriptor", () => {
    const control = mapFeatureFlagControl({
      name: "agents" as const,
      description: "Controls all agent execution",
      enabled: false,
      updatedAt: new Date("2024-02-02T00:00:00Z"),
    });

    expect(control.id).toBe("flag.agents");
    expect(control.scope).toBe("tenant");
    expect(control.status).toBe("disabled");
    expect(control.reason).toBe("Feature is disabled for this tenant.");
  });
});
