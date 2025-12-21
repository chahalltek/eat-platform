import { describe, expect, it } from "vitest";

import { BRANDING } from "@/config/branding";
import { DEFAULT_BRAND_LOGO, DEFAULT_BRAND_LOGO_ALT, DEFAULT_BRAND_NAME } from "@/lib/tenant/branding.shared";

import { resolveLoginLogoSources } from "./loginBranding";

const baseBranding = {
  brandName: DEFAULT_BRAND_NAME,
  brandLogoUrl: null,
  brandLogoAlt: DEFAULT_BRAND_LOGO_ALT,
};

describe("login logo sources", () => {
  it("never includes /public paths", () => {
    const sources = resolveLoginLogoSources(baseBranding);

    sources.forEach((src) => {
      expect(src.includes("/public/")).toBe(false);
    });
  });

  it("returns the canonical fallback order", () => {
    const sources = resolveLoginLogoSources(baseBranding);

    expect(sources).toEqual(["/ete-logo.svg", BRANDING.logoHorizontal, DEFAULT_BRAND_LOGO]);
  });

  it("normalizes custom logos", () => {
    const sources = resolveLoginLogoSources({
      ...baseBranding,
      brandLogoUrl: "branding/custom-logo.svg",
    });

    expect(sources[0]).toBe("/branding/custom-logo.svg");
  });
});
