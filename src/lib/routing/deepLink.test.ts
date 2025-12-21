import { describe, expect, it } from "vitest";

import { normalizeSearchParamValue, resolveDeepLinkDestination } from "./deepLink";

describe("resolveDeepLinkDestination", () => {
  it("defaults to the fulfillment dashboard when no IDs are present", () => {
    expect(resolveDeepLinkDestination({})).toBe("/dashboard");
  });

  it("routes to a job detail view when jobId is present", () => {
    expect(
      resolveDeepLinkDestination({
        jobId: "job-123",
      }),
    ).toBe("/jobs/job-123");
  });

  it("routes to a candidate detail view when candidateId is present", () => {
    expect(
      resolveDeepLinkDestination({
        candidateId: "candidate-456",
      }),
    ).toBe("/candidates/candidate-456");
  });

  it("prefers jobId when both identifiers are present", () => {
    expect(
      resolveDeepLinkDestination({
        jobId: "job-123",
        candidateId: "candidate-456",
      }),
    ).toBe("/jobs/job-123");
  });

  it("preserves attribution metadata in the redirected URL", () => {
    expect(
      resolveDeepLinkDestination({
        jobId: "job-123",
        from: "bullhorn",
        returnUrl: "https://bullhorn.example.com/record/job-123",
      }),
    ).toBe("/jobs/job-123?from=bullhorn&returnUrl=https%3A%2F%2Fbullhorn.example.com%2Frecord%2Fjob-123");
  });

  it("ignores empty string values", () => {
    expect(
      resolveDeepLinkDestination({
        jobId: "   ",
        from: "",
        returnUrl: "",
      }),
    ).toBe("/dashboard");
  });
});

describe("normalizeSearchParamValue", () => {
  it("returns the first element when provided an array", () => {
    expect(normalizeSearchParamValue(["abc", "def"])).toBe("abc");
  });

  it("trims whitespace-only strings to null", () => {
    expect(normalizeSearchParamValue("   ")).toBeNull();
  });
});
