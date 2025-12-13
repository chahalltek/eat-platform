import { describe, expect, it } from "vitest";

import { DEPLOYMENT_MODES } from "@/lib/deployment/deploymentModes";

import { getBrandingConfig } from "./branding";

describe("branding configuration", () => {
  const baseEnv = { NODE_ENV: "test", APP_ENV: "development" } as NodeJS.ProcessEnv;

  it("applies deployment presets when overrides are missing", () => {
    const branding = getBrandingConfig({ ...baseEnv, DEPLOYMENT_MODE: DEPLOYMENT_MODES.DEMO });

    expect(branding.headerText).toContain("Demo mode");
    expect(branding.accentColor).toBe("#f97316");
  });

  it("allows environment overrides for branding", () => {
    const branding = getBrandingConfig({
      ...baseEnv,
      NEXT_PUBLIC_ETE_APP_NAME: "Acme Talent Engine",
      NEXT_PUBLIC_ETE_BRAND_ACCENT_COLOR: "#123456",
      NEXT_PUBLIC_ETE_BRAND_HEADER_TEXT: "Acme managed deployment",
    });

    expect(branding.name).toBe("Acme Talent Engine");
    expect(branding.accentColor).toBe("#123456");
    expect(branding.headerText).toBe("Acme managed deployment");
  });
});
