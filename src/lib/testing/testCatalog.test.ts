import { describe, expect, it } from "vitest";

import { getETEAdminTestCatalog } from "./testCatalog";

describe("getETEAdminTestCatalog", () => {
  const catalog = getETEAdminTestCatalog();

  it("returns a non-empty list", () => {
    expect(catalog.length).toBeGreaterThan(0);
  });

  it("provides human-readable test metadata", () => {
    for (const item of catalog) {
      expect(item.id).toMatch(/[a-z0-9-]+/);
      expect(item.title.length).toBeGreaterThan(5);
      expect(item.description.length).toBeGreaterThan(10);
      expect(item.tags.length).toBeGreaterThan(0);
      expect(item.localCommand.length).toBeGreaterThan(5);
      expect(["string", "undefined"].includes(typeof item.ciStep)).toBe(true);
      expect(["boolean", "undefined"].includes(typeof item.blockedInVercel)).toBe(true);
    }
  });

  it("includes the admin listing endpoint auth check", () => {
    expect(catalog.some((item) => item.id === "admin-listing-auth")).toBe(true);
  });
});
