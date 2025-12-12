import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { SITE_NAME, SITE_DESCRIPTION } from "@/config/siteMetadata";
import { BRANDING } from "@/config/branding";

const homePath = path.join(process.cwd(), "src", "app", "page.tsx");
const homeSource = fs.readFileSync(homePath, "utf8");

describe("main page branding", () => {
  it("pulls hero branding from the shared config", () => {
    expect(homeSource).toContain("BRANDING.name");
    expect(homeSource).toContain("BRANDING.description");
    expect(homeSource).toContain("BRANDING.tagline");
  });

  it("keeps site metadata aligned with configurable branding", () => {
    expect(SITE_NAME).toBe(BRANDING.name);
    expect(SITE_DESCRIPTION).toBe(BRANDING.description);
  });
});
