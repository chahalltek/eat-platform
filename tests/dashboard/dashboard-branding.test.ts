import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const dashboardPath = path.join(process.cwd(), "src", "app", "dashboard", "page.tsx");
const dashboardSource = fs.readFileSync(dashboardPath, "utf8");

describe("dashboard page branding", () => {
  it("links back to the main console entry point", () => {
    expect(dashboardSource).toContain('href="/"');
  });

  it("keeps the dashboard headline copy", () => {
    expect(dashboardSource).toMatch(/Dashboard/);
    expect(dashboardSource).toMatch(/Observability/);
  });
});
