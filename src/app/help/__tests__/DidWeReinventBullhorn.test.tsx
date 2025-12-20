/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";

import { DidWeReinventBullhorn } from "../DidWeReinventBullhorn";
import { eteVsBullhornContent } from "@/content/help/eteVsBullhorn";

describe("DidWeReinventBullhorn", () => {
  it("renders title and unique phrase", () => {
    render(<DidWeReinventBullhorn entry={eteVsBullhornContent} />);

    expect(screen.getByRole("heading", { name: /did we reinvent bullhorn/i })).toBeInTheDocument();
    expect(screen.getByText(/bullhorn remains the recruiting system of record/i)).toBeInTheDocument();
  });

  it("renders bullet sections", () => {
    render(<DidWeReinventBullhorn entry={eteVsBullhornContent} />);

    expect(screen.getByText(/what bullhorn’s ai does well/i)).toBeInTheDocument();
    expect(screen.getByText(/what ete does that bullhorn doesn’t/i)).toBeInTheDocument();
  });
});
