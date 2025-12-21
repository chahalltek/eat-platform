/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";

import { FulfillmentContent } from "./FulfillmentContent";

describe("FulfillmentContent", () => {
  it("hides the Publish button when the user cannot publish", () => {
    render(<FulfillmentContent canPublish={false} />);

    expect(screen.queryByText("Publish")).not.toBeInTheDocument();
  });

  it("shows the Publish button when allowed", () => {
    render(<FulfillmentContent canPublish />);

    expect(screen.getByText("Publish")).toBeInTheDocument();
  });
});
