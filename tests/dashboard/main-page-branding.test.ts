import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { SITE_NAME, SITE_DESCRIPTION } from "@/config/siteMetadata";

const homePath = path.join(process.cwd(), "src", "app", "page.tsx");
const homeSource = fs.readFileSync(homePath, "utf8");

describe("main page branding", () => {
  it("uses the ETE console branding on the hero", () => {
    expect(homeSource).toMatch(/EDGE Talent Engine/);
    expect(homeSource).toMatch(/ETE Console/);
  });

  it("defaults site metadata to the EDGE Talent Engine brand", () => {
    expect(SITE_NAME).toBe("EDGE Talent Engine");
    expect(SITE_DESCRIPTION).toContain("EDGE Talent Engine");
  });
});
