/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BRANDING } from "@/config/branding";
import type { TenantBranding } from "@/lib/tenant/branding.shared";

import { LoginContent } from "./LoginContent";

const push = vi.fn();
const mockSearchParams = { get: vi.fn() };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => mockSearchParams,
}));

const baseBranding: TenantBranding = {
  brandLogoAlt: "Tenant logo",
  brandLogoUrl: null,
  brandName: "Tenant",
};

describe("LoginContent logo behavior", () => {
  beforeEach(() => {
    push.mockReset();
    mockSearchParams.get.mockReturnValue(null);
  });

  it("prefers tenant logo when provided", () => {
    const branding: TenantBranding = { ...baseBranding, brandLogoUrl: "/tenant/logo.png" };

    render(<LoginContent branding={branding} />);

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "/tenant/logo.png");
  });

  it("uses canonical default logo when tenant logo is not provided", () => {
    render(<LoginContent branding={baseBranding} />);

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "/ete-logo.svg");
  });

  it("falls back to next logo source on error", () => {
    render(<LoginContent branding={baseBranding} />);

    const img = screen.getByRole("img");

    expect(img).toHaveAttribute("src", "/ete-logo.svg");

    fireEvent.error(img);

    expect(img).toHaveAttribute("src", BRANDING.logoHorizontal);
  });
});
