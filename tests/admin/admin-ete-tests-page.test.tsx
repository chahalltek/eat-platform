/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  canManageFeatureFlags: vi.fn(),
}));

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/auth/permissions", () => ({
  canManageFeatureFlags: mocks.canManageFeatureFlags,
}));

vi.mock("@/components/ETEClientLayout", () => ({
  ETEClientLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="ete-layout">{children}</div>
  ),
}));

import AdminEteTestsPage from "@/app/admin/ete/tests/page";
import { AdminEteTestsClient } from "@/app/admin/ete/tests/AdminEteTestsClient";

const QUICK_COMMANDS = [
  {
    id: "pipeline",
    title: "Pipeline health",
    bulletPoints: ["Verify critical ingest path"],
    command: "npm run ete:tests -- --scenario pipeline-health",
  },
  {
    id: "ui-smoke",
    title: "UI smoke",
    bulletPoints: ["Cover UI filters"],
    command: "npm run ete:tests -- --scenario ui-smoke",
  },
];

const TEST_CATALOG = [
  {
    id: "api-health",
    title: "API health",
    description: "Checks the core API stack",
    jobTemplate: "Backend",
    discipline: "Infra",
    command: QUICK_COMMANDS[0].command,
    ciCadence: "Daily",
    ciStatus: "Stable",
  },
  {
    id: "ui-flows",
    title: "UI flows",
    description: "Validates filtering and selection flows",
    jobTemplate: "Frontend",
    discipline: "Product",
    command: QUICK_COMMANDS[1].command,
    ciCadence: "Nightly",
    ciStatus: "Beta",
  },
];

describe("Admin ETE tests page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders the catalog for admins", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    mocks.canManageFeatureFlags.mockReturnValue(true);

    const page = await AdminEteTestsPage();
    render(page);

    expect(screen.getByTestId("ete-layout")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /on-demand test runner/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/quick compare per discipline/i),
    ).toBeInTheDocument();
  });

  it("denies access when the user cannot manage features", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1", role: "RECRUITER" });
    mocks.canManageFeatureFlags.mockReturnValue(false);

    const page = await AdminEteTestsPage();
    render(page);

    expect(screen.getByText(/admins only/i)).toBeInTheDocument();
    expect(
      screen.getByText(/switch to an admin user to continue/i),
    ).toBeInTheDocument();
  });
});

describe("AdminEteTestsClient", () => {
  let clipboardWrite: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();
    clipboardWrite = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: clipboardWrite,
      },
      writable: true,
      configurable: true,
    });
  });

  it("filters catalog entries based on search and updates selection", async () => {
    const user = userEvent.setup({ writeClipboardText: clipboardWrite });
    render(
      <AdminEteTestsClient
        quickCommands={QUICK_COMMANDS}
        tests={TEST_CATALOG}
        isVercelLimited={false}
      />,
    );

    const apiHeadings = await screen.findAllByText("API health");
    expect(apiHeadings[0]).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(
      /search by title, description, job template, or discipline/i,
    );

    await user.type(searchInput, "UI flows");

    expect(
      await screen.findByText(/validates filtering and selection flows/i),
    ).toBeInTheDocument();
  });

  it("copies quick command and selected test command to the clipboard", async () => {
    render(
      <AdminEteTestsClient
        quickCommands={QUICK_COMMANDS}
        tests={TEST_CATALOG}
        isVercelLimited
      />,
    );

    const quickCopyButton = screen.getAllByText(/copy command/i)[0];
    fireEvent.click(quickCopyButton);

    await waitFor(() =>
      expect(clipboardWrite).toHaveBeenCalledWith(QUICK_COMMANDS[0].command),
    );
    expect(screen.getByText(/copied/i)).toBeInTheDocument();

    const detailCopyButton = screen.getAllByText(/copy command/i).at(-1);
    if (!detailCopyButton) {
      throw new Error("Detail copy button missing");
    }

    fireEvent.click(detailCopyButton);

    await waitFor(() =>
      expect(clipboardWrite).toHaveBeenCalledWith(TEST_CATALOG[0].command),
    );
  });
});
