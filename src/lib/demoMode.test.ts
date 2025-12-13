import { describe, expect, it } from "vitest";

import { DEPLOYMENT_MODES } from "./deployment/deploymentModes";
import { isPublicDemoMode } from "./demoMode";

describe("demo mode", () => {
  const baseEnv = { NODE_ENV: "test", APP_ENV: "development" } as NodeJS.ProcessEnv;

  it("treats the demo deployment mode as read-only", () => {
    const env = { ...baseEnv, DEPLOYMENT_MODE: DEPLOYMENT_MODES.DEMO } as NodeJS.ProcessEnv;

    expect(isPublicDemoMode(env)).toBe(true);
  });

  it("supports an explicit demo flag override", () => {
    const env = { ...baseEnv, ETE_PUBLIC_DEMO: "true" } as NodeJS.ProcessEnv;

    expect(isPublicDemoMode(env)).toBe(true);
  });

  it("defaults to non-demo modes when unset", () => {
    const env = { ...baseEnv, DEPLOYMENT_MODE: DEPLOYMENT_MODES.INTERNAL_STRSI } as NodeJS.ProcessEnv;

    expect(isPublicDemoMode(env)).toBe(false);
  });
});
