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
      expect(item.localTestCommand.length).toBeGreaterThan(5);
      expect(typeof item.ciSnippet).toBe("string");
      expect(typeof item.blockedInVercel).toBe("boolean");
    }
  });
});
