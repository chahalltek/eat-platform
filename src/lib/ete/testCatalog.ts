import { TEST_PLAN_ITEMS, TEST_PLAN_SECTIONS } from "./testPlanRegistry";

export type TestCatalogItem = {
  id: string;
  sectionId: string;
  sectionTitle: string;
  sectionSubtitle: string | null;
  label: string;
  description: string;
  isCritical: boolean;
};

export function getEteTestCatalog(): { count: number; items: TestCatalogItem[] } {
  const sectionsById = new Map(TEST_PLAN_SECTIONS.map((section) => [section.id, section]));

  const items: TestCatalogItem[] = TEST_PLAN_ITEMS.map((item) => {
    const section = sectionsById.get(item.sectionId);

    return {
      id: item.id,
      sectionId: item.sectionId,
      sectionTitle: section?.title ?? item.sectionId,
      sectionSubtitle: section?.subtitle ?? null,
      label: item.label,
      description: item.description,
      isCritical: Boolean(item.isCritical),
    };
  });

  return {
    count: items.length,
    items,
  };
}
