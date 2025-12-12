import { describe, expect, it } from "vitest";

import { FEATURE_FLAGS } from "@/lib/featureFlags/constants";

import {
  DEPLOYMENT_MODES,
  getDeploymentFeatureFlagDefaults,
  getDeploymentMode,
  parseFeatureFlagDefaults,
} from "./deploymentModes";

describe("deploymentModes", () => {
  it("falls back to the internal STRSI deployment mode", () => {
    expect(getDeploymentMode({ NODE_ENV: "test", APP_ENV: "development" })).toBe(
      DEPLOYMENT_MODES.INTERNAL_STRSI,
    );
  });

  it("parses default feature flags with booleans and negation", () => {
    const parsed = parseFeatureFlagDefaults("agents,scoring=false,-ui-blocks");

    expect(parsed.get(FEATURE_FLAGS.AGENTS)).toBe(true);
    expect(parsed.get(FEATURE_FLAGS.SCORING)).toBe(false);
    expect(parsed.get(FEATURE_FLAGS.UI_BLOCKS)).toBe(false);
  });

  it("returns deployment presets merged with overrides", () => {
    const env = {
      NODE_ENV: "test",
      APP_ENV: "development",
      DEPLOYMENT_MODE: DEPLOYMENT_MODES.DEMO,
      DEFAULT_FEATURE_FLAGS: "agents=true",
    } as NodeJS.ProcessEnv;

    const defaults = getDeploymentFeatureFlagDefaults(env);

    expect(defaults.get(FEATURE_FLAGS.AGENTS)).toBe(true);
    expect(defaults.get(FEATURE_FLAGS.SCORING)).toBe(false);
    expect(defaults.get(FEATURE_FLAGS.UI_BLOCKS)).toBe(true);
  });
});
