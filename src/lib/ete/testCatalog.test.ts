import { describe, expect, it } from "vitest";

import { TEST_PLAN_ITEMS, TEST_PLAN_SECTIONS } from "./testPlanRegistry";
import { getEteTestCatalog } from "./testCatalog";

describe("getEteTestCatalog", () => {
  it("returns the full catalog with section metadata", () => {
    const catalog = getEteTestCatalog();

    expect(catalog.count).toBe(TEST_PLAN_ITEMS.length);
    expect(catalog.items).toHaveLength(TEST_PLAN_ITEMS.length);

    for (const item of catalog.items) {
      const sourceItem = TEST_PLAN_ITEMS.find((candidate) => candidate.id === item.id);
      const section = TEST_PLAN_SECTIONS.find((candidate) => candidate.id === item.sectionId);

      expect(sourceItem).toBeDefined();
      expect(section).toBeDefined();
      expect(item.sectionTitle).toBe(section?.title ?? item.sectionId);
      expect(item.sectionSubtitle).toBe(section?.subtitle ?? null);
      expect(item.label).toBe(sourceItem?.label);
      expect(item.description).toBe(sourceItem?.description);
      expect(item.isCritical).toBe(Boolean(sourceItem?.isCritical));
    }
  });
});
