/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FulfillmentNav } from "./FulfillmentNav";

const mockUsePathname = vi.fn(() => "/fulfillment");

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("FulfillmentNav", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/fulfillment");
  });

  it("renders fulfillment links when access is granted", () => {
    render(<FulfillmentNav canViewFulfillmentNav showDecisions={false} />);

    expect(screen.getByRole("navigation", { name: /fulfillment/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /jobs/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /candidates/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /decisions/i })).not.toBeInTheDocument();
  });

  it("shows the decisions link when the user can manage decisions", () => {
    mockUsePathname.mockReturnValue("/fulfillment/decisions");

    render(<FulfillmentNav canViewFulfillmentNav showDecisions />);

    expect(screen.getByRole("link", { name: /decisions/i })).toHaveClass("bg-indigo-50");
  });

  it("renders nothing when fulfillment access is missing", () => {
    const { container } = render(<FulfillmentNav canViewFulfillmentNav={false} showDecisions={false} />);

    expect(container).toBeEmptyDOMElement();
  });
});
