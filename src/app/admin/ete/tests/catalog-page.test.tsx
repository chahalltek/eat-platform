/**
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CatalogPageClient } from "../catalog/CatalogPageClient";

describe("CatalogPageClient", () => {
  const sampleItems = [
    {
      id: "data.refresh",
      name: "Refresh candidate data cache",
      category: "data",
      description: "Refreshes candidate data sources and clears stale cache entries.",
      quickCommands: ["kubectl exec data-cache --refresh", "curl -XPOST /internal/cache/refresh"],
      snippet: "kubectl exec data-cache --refresh",
    },
    {
      id: "runtime.inspect",
      name: "Inspect runtime queue",
      category: "runtime",
      description: "Check queue depth and stuck jobs.",
      quickCommands: ["kubectl logs runtime-queue --tail 100"],
      snippet: "kubectl logs runtime-queue --tail 100",
    },
  ];

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ items: sampleItems }),
      })) as unknown as typeof fetch,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the header and quick commands", async () => {
    render(<CatalogPageClient />);

    await screen.findAllByRole("listitem");
    expect(screen.getByRole("heading", { name: /ete knowledge catalog/i })).toBeInTheDocument();
    const quickCommands = screen.getByLabelText(/^quick commands$/i);
    expect(within(quickCommands).getAllByRole("button").length).toBeGreaterThan(0);
  });

  it("loads the list from the mocked API", async () => {
    render(<CatalogPageClient />);

    const list = await screen.findByRole("list", { name: /catalog items/i });
    await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(2));
    expect(screen.getByText(/Showing 2 items/i)).toBeInTheDocument();
  });

  it("filters items using the search input", async () => {
    const user = userEvent.setup();
    render(<CatalogPageClient />);

    const list = await screen.findByRole("list", { name: /catalog items/i });
    await within(list).findByText(/Inspect runtime queue/i);
    await user.type(screen.getByRole("searchbox", { name: /filter/i }), "runtime");

    expect(within(list).queryByText(/Refresh candidate data cache/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Inspect runtime queue/i)).toBeInTheDocument();
  });

  it("updates the details panel when selecting an item", async () => {
    const user = userEvent.setup();
    render(<CatalogPageClient />);

    const list = await screen.findByRole("list", { name: /catalog items/i });
    const runtimeItem = (await within(list).findByText(/Inspect runtime queue/i)).closest("button") as HTMLButtonElement;
    await user.click(runtimeItem);

    expect(screen.getByRole("heading", { name: /Inspect runtime queue/i })).toBeInTheDocument();
    expect(screen.getByText(/queue depth and stuck jobs/i)).toBeInTheDocument();
  });

  it("writes a snippet to the clipboard when copying", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    render(<CatalogPageClient clipboard={{ writeText }} />);

    const list = await screen.findByRole("list", { name: /catalog items/i });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: /copy snippet/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("kubectl exec data-cache --refresh"));
  });
});
