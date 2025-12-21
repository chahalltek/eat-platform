/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { JobDetailCockpit, type JobSummary } from "./JobDetailCockpit";

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const baseJob: JobSummary = {
  id: "job-123",
  title: "Lead Recruiter",
  client: "ACME Corp",
  priority: "High",
  owner: "Taylor Recruiter",
};

describe("JobDetailCockpit", () => {
  it("switches tabs to show the selected content", async () => {
    const user = userEvent.setup();

    render(
      <JobDetailCockpit
        job={baseJob}
        showDeepLinkBanner={false}
        returnUrl={undefined}
        sourceSystem={undefined}
      />,
    );

    expect(screen.getByRole("tabpanel")).toHaveTextContent(/intake and requirements/i);

    await user.click(screen.getByRole("tab", { name: /shortlist/i }));

    expect(screen.getByRole("tabpanel")).toHaveTextContent(/prioritize the strongest candidates/i);
  });

  it("renders the deep link banner when a return URL is present", () => {
    render(
      <JobDetailCockpit
        job={baseJob}
        showDeepLinkBanner
        returnUrl="https://example.com/bullhorn/return"
        sourceSystem="system_of_record"
      />,
    );

    expect(screen.getByText(/deep link contract/i)).toBeInTheDocument();
    expect(screen.getByText(/system_of_record/i)).toBeInTheDocument();
    expect(screen.getByText("/fulfillment/jobs/job-123")).toBeInTheDocument();

    const returnButton = screen.getByRole("link", { name: /return/i });
    expect(returnButton).toHaveAttribute("href", "https://example.com/bullhorn/return");
  });

  it("hides the deep link banner when deep link params are missing", () => {
    render(
      <JobDetailCockpit
        job={baseJob}
        showDeepLinkBanner={false}
        returnUrl={undefined}
        sourceSystem={undefined}
      />,
    );

    expect(screen.queryByText(/deep link contract/i)).not.toBeInTheDocument();
  });
});
