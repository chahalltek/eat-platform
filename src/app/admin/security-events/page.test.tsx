/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listSecurityEvents } from "@/lib/audit/securityEvents";
import { getCurrentUser } from "@/lib/auth/user";

import SecurityEventsPage from "./page";

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/audit/securityEvents", () => ({
  listSecurityEvents: vi.fn(),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("Security events admin UI", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("blocks users without audit permissions", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      role: "Recruiter",
      tenantId: "tenant-1",
      email: null,
      displayName: null,
    } as never);

    const Page = await SecurityEventsPage();
    render(Page);

    expect(screen.getByText(/Audit privileges required/)).toBeInTheDocument();
  });

  it("renders security events for authorized admins", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-2",
      role: "ADMIN",
      tenantId: "tenant-1",
      email: "admin@example.com",
      displayName: "Admin User",
    } as never);

    vi.mocked(listSecurityEvents).mockResolvedValue([
      {
        id: "evt-1",
        tenantId: "tenant-1",
        userId: "user-2",
        eventType: "LOGIN_SUCCESS",
        metadata: { ip: "127.0.0.1" },
        createdAt: new Date("2024-01-01T00:00:00Z"),
      },
    ]);

    const Page = await SecurityEventsPage();
    render(Page);

    expect(screen.getByText("Security events")).toBeInTheDocument();
    expect(screen.getByText("LOGIN_SUCCESS")).toBeInTheDocument();
    expect(screen.getByText(/127.0.0.1/)).toBeInTheDocument();
  });
});
