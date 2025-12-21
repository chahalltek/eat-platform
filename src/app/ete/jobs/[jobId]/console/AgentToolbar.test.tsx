/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { AgentToolbar } from "./AgentToolbar";
import { USER_ROLES } from "@/lib/auth/roles";

describe("AgentToolbar", () => {
  it("shows only permitted actions for a sourcer", () => {
    const handler = vi.fn().mockResolvedValue(undefined);

    render(
      <AgentToolbar
        role={USER_ROLES.SOURCER}
        onRun={{
          intake: handler,
          profile: handler,
          match: handler,
          confidence: handler,
          explain: handler,
          shortlist: handler,
        }}
      />,
    );

    expect(screen.queryByRole("button", { name: "Run Intake" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run Profile" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run Match" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run Confidence" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run Explain" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run Shortlist" })).toBeInTheDocument();
  });

  it("shows all actions for a recruiter", () => {
    const handler = vi.fn().mockResolvedValue(undefined);

    render(
      <AgentToolbar
        role={USER_ROLES.RECRUITER}
        onRun={{
          intake: handler,
          profile: handler,
          match: handler,
          confidence: handler,
          explain: handler,
          shortlist: handler,
        }}
      />,
    );

    expect(screen.getByRole("button", { name: "Run Intake" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run Profile" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run Match" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run Confidence" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run Explain" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run Shortlist" })).toBeInTheDocument();
  });

  it("calls the handler and toggles loading state", async () => {
    const user = userEvent.setup();
    let resolveRun: () => void = () => {};
    const handler = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRun = resolve;
        }),
    );

    render(
      <AgentToolbar
        role={USER_ROLES.RECRUITER}
        actions={["match"]}
        onRun={{
          match: handler,
        }}
      />,
    );

    const button = screen.getByRole("button", { name: "Run Match" });
    await user.click(button);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Running/)).toBeInTheDocument();

    resolveRun();

    await waitFor(() => expect(button).toHaveTextContent("Run Match"));
    await waitFor(() => expect(screen.getByText(/Last run/i)).toBeInTheDocument());
  });
});
