import { describe, expect, it } from "vitest";

import { DEFAULT_BRAND_LOGO } from "./branding.shared";

describe("branding.shared defaults", () => {
  it("uses the canonical public logo path", () => {
    expect(DEFAULT_BRAND_LOGO).toBe("/ete-logo.svg");
  });

  it("never references /public in a URL path", () => {
    expect(DEFAULT_BRAND_LOGO.includes("/public/")).toBe(false);
  });

  it("is an absolute public path", () => {
    expect(DEFAULT_BRAND_LOGO.startsWith("/")).toBe(true);
  });
});
