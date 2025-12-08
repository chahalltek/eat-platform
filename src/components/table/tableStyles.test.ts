/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";
import { getTableRowClasses, getTableStyles } from "./tableStyles";

describe("tableStyles", () => {
  it("returns comfortable preset by default", () => {
    const styles = getTableStyles();

    expect(styles.variant).toBe("comfortable");
    expect(styles.classes.table).toContain("rounded-lg");
    expect(styles.classes.cell).toContain("py-3");
    expect(styles.states.hover).toContain("hover");
  });

  it("maps compact variant to compact padding and density", () => {
    const styles = getTableStyles("compact");

    expect(styles.variant).toBe("compact");
    expect(styles.density).toBe("compact");
    expect(styles.classes.cell).toContain("py-2");
    expect(styles.classes.headerCell).toContain("px-3");
  });

  it("composes row classes with requested states", () => {
    const styles = getTableStyles();

    const withStates = getTableRowClasses(styles, { hover: true, selected: true, striped: true });

    expect(withStates).toContain(styles.classes.row);
    expect(withStates).toContain(styles.states.hover);
    expect(withStates).toContain(styles.states.selected);
    expect(withStates).toContain(styles.states.striped);
  });
});
