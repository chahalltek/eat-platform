/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { getTestPlanSectionsWithItems } from "@/lib/ete/testPlanRegistry";

import { TestPlanChecklist } from "./TestPlanChecklist";

const sections = getTestPlanSectionsWithItems();

const baseStatuses = {
  "mvp.match": {
    status: "pass",
    note: "charter green",
    updatedBy: "admin@example.com",
    updatedAt: new Date("2024-01-01T00:00:00.000Z").toISOString(),
  },
  "flags.view": {
    status: "not_run",
    note: "",
    updatedBy: "admin@example.com",
    updatedAt: new Date("2024-01-02T00:00:00.000Z").toISOString(),
  },
};

describe("TestPlanChecklist", () => {
  it("filters items by status and critical flag", async () => {
    const user = userEvent.setup();
    render(<TestPlanChecklist sections={sections} initialStatuses={baseStatuses} />);

    expect(screen.getByText(/MATCH – returns and ranks matches/i)).toBeInTheDocument();
    expect(screen.getByText(/Feature flags – view/i)).toBeInTheDocument();

    const passFilters = screen.getAllByRole("button", { name: /^Pass$/ });
    await user.click(passFilters[0]);

    expect(screen.getByText(/MATCH – returns and ranks matches/i)).toBeInTheDocument();
    expect(screen.queryByText(/Feature flags – view/i)).not.toBeInTheDocument();

    await user.click(screen.getByLabelText(/Show only critical/i));

    expect(screen.getByText(/MATCH – returns and ranks matches/i)).toBeInTheDocument();
  });

  it("shows summary counts from registry items", () => {
    render(<TestPlanChecklist sections={sections} initialStatuses={baseStatuses} />);

    expect(screen.getByText(/items touched/i)).toBeInTheDocument();
    expect(screen.getByText(/critical items remaining/i)).toBeInTheDocument();
  });
});
