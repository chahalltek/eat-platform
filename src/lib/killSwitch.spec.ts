import { afterEach, describe, expect, test } from "vitest";

import { KILL_SWITCHES } from "@/lib/killSwitch";
import {
  assertKillSwitchDisarmed,
  isKillSwitchLatched,
  latchKillSwitch,
  resetAllKillSwitches,
} from "@/lib/killSwitch";
import { enforceKillSwitch } from "@/lib/killSwitch/middleware";

const resetEnv = () => {
  delete process.env.KILL_SWITCH_AGENTS;
  delete process.env.KILL_SWITCH_SCORERS;
  delete process.env.KILL_SWITCH_BUILDERS;
};

afterEach(() => {
  resetEnv();
  resetAllKillSwitches();
});

describe("kill switch", () => {
  test("safe shutdown: requests short-circuit when kill switch is latched", async () => {
    latchKillSwitch(KILL_SWITCHES.SCORERS, "bad output detected");

    const response = enforceKillSwitch(KILL_SWITCHES.SCORERS, { componentName: "Scoring" });

    expect(response?.status).toBe(503);

    const payload = await response?.json();
    expect(payload).toMatchObject({
      error: "Scoring is currently disabled",
      reason: "bad output detected",
    });
  });

  test("latched state persists after environment trigger is cleared", () => {
    process.env.KILL_SWITCH_AGENTS = "panic";

    expect(isKillSwitchLatched(KILL_SWITCHES.AGENTS)).toBe(true);

    delete process.env.KILL_SWITCH_AGENTS;

    expect(isKillSwitchLatched(KILL_SWITCHES.AGENTS)).toBe(true);
    expect(() => assertKillSwitchDisarmed(KILL_SWITCHES.AGENTS)).toThrowError(
      /Agents is disabled via kill switch: panic/,
    );
  });
});
