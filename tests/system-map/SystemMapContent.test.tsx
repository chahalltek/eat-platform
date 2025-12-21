/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDefaultNodeHealth, type SystemMapNode } from "@/app/system-map/opsImpact";
import { SystemMapContent } from "@/app/ete/system-map/SystemMapContent";

const mockUseSystemMapHealth = vi.hoisted(() =>
  vi.fn(() => ({
    health: createDefaultNodeHealth(),
    isPolling: false,
    isUnavailable: false,
    lastUpdated: "2025-01-01T00:00:00.000Z",
  })),
);

vi.mock("@/lib/hooks/useSystemMapHealth", () => ({
  useSystemMapHealth: (...args: Parameters<typeof mockUseSystemMapHealth>) => mockUseSystemMapHealth(...args),
}));

const nodes: SystemMapNode[] = [
  {
    id: "intake",
    name: "Intake",
    type: "Entry",
    summary: "Test summary",
    tags: [],
    impact: "halts",
  },
  {
    id: "runtime_controls",
    name: "Runtime Controls",
    type: "Control",
    summary: "Runtime controls summary",
    tags: [],
    impact: "fails_closed",
  },
] as const;

const flowSequences = [
  {
    label: "Test flow",
    steps: ["Step 1", "Step 2"],
  },
] as const;

const statusLegend = [
  { status: "healthy", label: "Healthy" },
  { status: "idle", label: "Idle" },
  { status: "waiting", label: "Waiting" },
  { status: "fault", label: "Fault" },
  { status: "disabled", label: "Disabled" },
] as const;

function renderSystemMap() {
  return render(
    <SystemMapContent
      apiMapDocUrl="https://example.test"
      apiMapLastUpdatedIso="2025-01-01T00:00:00.000Z"
      apiMapLastUpdatedDisplay="JAN 1, 2025"
      systemNodes={nodes}
      flowSequences={flowSequences}
      statusLegend={statusLegend}
    />,
  );
}

describe("SystemMapContent overlay", () => {
  beforeEach(() => {
    const healthy = createDefaultNodeHealth();
    healthy.intake = { status: "fault", message: "Down" };
    healthy.runtime_controls = { status: "disabled", message: "Intentional" };
    mockUseSystemMapHealth.mockReturnValue({
      health: healthy,
      isPolling: false,
      isUnavailable: false,
      lastUpdated: "2025-01-01T00:00:00.000Z",
    });
  });

  it("renders fault pill and highlight when overlay is enabled", () => {
    renderSystemMap();

    const toggle = screen.getByLabelText(/toggle ops impact overlay/i);
    fireEvent.click(toggle);

    const intakeCard = screen.getByTestId("system-map-node-intake");
    expect(intakeCard).toHaveTextContent("Fault");
    expect(intakeCard).toHaveClass("ring-rose-100", { exact: false });
    expect(screen.getByText(/currently impacting/i)).toBeInTheDocument();
  });

  it("shows disabled messaging for intentional shutdowns", () => {
    renderSystemMap();

    const toggle = screen.getByLabelText(/toggle ops impact overlay/i);
    fireEvent.click(toggle);

    const runtimeCard = screen.getByTestId("system-map-node-runtime_controls");
    expect(runtimeCard).toHaveTextContent("Disabled");
    expect(runtimeCard).toHaveTextContent("Disabled (intentional)");
  });
});
