/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TenantPlanEditor } from "./[tenantId]/TenantPlanEditor";
import { TenantsTable } from "./page";

describe("admin tenant UI", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the tenant list table", () => {
    render(
      <TenantsTable
        tenants={[
          {
            id: "tenant-1",
            name: "Tenant One",
            status: "active",
            mode: "SANDBOX",
            createdAt: new Date("2024-01-01T00:00:00.000Z"),
            plan: { id: "plan-1", name: "Starter" },
            isTrial: false,
            trialEndsAt: null,
          },
        ]}
      />,
    );

    expect(screen.getByText("Tenant One")).toBeInTheDocument();
    expect(screen.getByText("Starter")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("lets admins change the plan", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          tenant: {
            id: "tenant-1",
            name: "Tenant One",
            status: "active",
            mode: "SANDBOX",
            createdAt: new Date("2024-01-01T00:00:00.000Z"),
            plan: { id: "plan-2", name: "Pro" },
            isTrial: true,
            trialEndsAt: "2024-03-01T00:00:00.000Z",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    render(
      <TenantPlanEditor
        tenantId="tenant-1"
        tenantName="Tenant One"
        status="active"
        mode="SANDBOX"
        currentPlanId="plan-1"
        currentPlanName="Starter"
        isTrial={false}
        trialEndsAt={null}
        plans={[
          { id: "plan-1", name: "Starter" },
          { id: "plan-2", name: "Pro" },
        ]}
      />,
    );

    fireEvent.change(screen.getByLabelText(/assign plan/i), { target: { value: "plan-2" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(screen.getByText(/plan updated successfully/i)).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/tenants/tenant-1",
      expect.objectContaining({
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(
      screen.getByText((content, element) => element?.tagName === "SPAN" && content.includes("Pro")),
    ).toBeInTheDocument();
    expect(screen.getByText(/Trial: Yes/)).toBeInTheDocument();
  });

  it("shows errors from failed updates", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TenantPlanEditor
        tenantId="tenant-2"
        tenantName="Tenant Two"
        status="active"
        mode="SANDBOX"
        currentPlanId={"plan-1"}
        currentPlanName="Starter"
        isTrial={false}
        trialEndsAt={null}
        plans={[{ id: "plan-1", name: "Starter" }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Forbidden"));
  });
});
