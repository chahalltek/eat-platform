import { describe, expect, it } from "vitest";

import { buildSafeLLMContext } from "./safeContext";

describe("buildSafeLLMContext", () => {
  it("drops full resume blobs and other raw fields", () => {
    const context = buildSafeLLMContext({
      purpose: "MATCH",
      candidates: [
        {
          skills: ["typescript"],
          titles: ["Engineer"],
          fullResumeText: "This should be removed",
          freeformNotes: "Also remove this",
          bullhornIds: ["bh-1"],
        },
      ],
    });

    expect(context.candidates?.[0]).toEqual({
      skills: ["typescript"],
      titles: ["Engineer"],
    });
  });

  it("drops email and phone fields when present", () => {
    const context = buildSafeLLMContext({
      purpose: "PROFILE",
      candidates: [
        {
          skills: ["javascript"],
          email: "user@example.com",
          phone: "555-555-5555",
          address: "123 Main St",
        },
      ],
    });

    expect(context.candidates?.[0]).toEqual({
      skills: ["javascript"],
    });
  });

  it("drops job and candidate ids", () => {
    const context = buildSafeLLMContext({
      purpose: "EXPLAIN",
      job: {
        title: "Designer",
        id: "job-123",
      },
      candidates: [
        {
          titles: ["Lead Designer"],
          id: "cand-789",
        },
      ],
      metadata: {
        requestId: "req-1",
        correlationId: "corr-1",
      },
    });

    expect(context.job).toEqual({ title: "Designer" });
    expect(context.candidates?.[0]).toEqual({ titles: ["Lead Designer"] });
    expect(context.metadata).toEqual({ requestId: "req-1", correlationId: "corr-1" });
  });

  it("preserves allowlisted fields", () => {
    const context = buildSafeLLMContext({
      purpose: "SHORTLIST",
      job: {
        title: "Backend Engineer",
        skillsRequired: ["node", "sql"],
        skillsPreferred: ["aws"],
        seniority: "mid",
        locationRegion: "NY",
        workMode: "hybrid",
        compBand: "L4",
        startDateWindow: "Q2",
        domainTags: ["fintech"],
      },
      candidates: [
        {
          skills: ["node", "typescript"],
          titles: ["Engineer"],
          seniority: "mid",
          yearsExperience: 5,
          certifications: ["AWS Associate"],
          locationRegion: "NY",
          workAuthorization: "US Citizen",
          availabilityWindow: "2 weeks",
          compBand: "L3",
          domainTags: ["fintech"],
        },
      ],
      tenant: {
        name: "Acme Corp",
        domainTags: ["tech"],
      },
      metadata: {
        requestId: "req-123",
        correlationId: "corr-456",
      },
    });

    expect(context).toEqual({
      purpose: "SHORTLIST",
      job: {
        title: "Backend Engineer",
        skillsRequired: ["node", "sql"],
        skillsPreferred: ["aws"],
        seniority: "mid",
        locationRegion: "NY",
        workMode: "hybrid",
        compBand: "L4",
        startDateWindow: "Q2",
        domainTags: ["fintech"],
      },
      candidates: [
        {
          skills: ["node", "typescript"],
          titles: ["Engineer"],
          seniority: "mid",
          yearsExperience: 5,
          certifications: ["AWS Associate"],
          locationRegion: "NY",
          workAuthorization: "US Citizen",
          availabilityWindow: "2 weeks",
          compBand: "L3",
          domainTags: ["fintech"],
        },
      ],
      tenant: {
        name: "Acme Corp",
        domainTags: ["tech"],
      },
      metadata: {
        requestId: "req-123",
        correlationId: "corr-456",
      },
    });
  });

  it("handles invalid shapes by falling back to safe defaults", () => {
    const context = buildSafeLLMContext({
      purpose: "NOT_A_VALID_PURPOSE" as any,
      job: { title: 123 as any, skillsRequired: ["node", 5] },
      candidates: [
        { skills: ["ok"], titles: [], certifications: [], yearsExperience: "5" as any },
        "bad-entry" as any,
      ],
      tenant: "acme" as any,
      metadata: { requestId: 123 as any, correlationId: {} as any },
    });

    expect(context.purpose).toBe("OTHER");
    expect(context.job).toEqual({ skillsRequired: ["node", "5"] });
    expect(context.candidates?.length).toBe(1);
    expect(context.candidates?.[0]?.skills).toEqual(["ok"]);
    expect(context.candidates?.[0]?.titles).toBeUndefined();
    expect(context.metadata).toBeUndefined();
    expect(context.tenant).toBeUndefined();
  });

  it("drops empty job and candidate entries entirely", () => {
    const context = buildSafeLLMContext({
      purpose: "OTHER",
      job: null as any,
      candidates: ["foo" as any],
      tenant: 123 as any,
    });

    expect(context.job).toBeUndefined();
    expect(context.candidates).toBeUndefined();
    expect(context.tenant).toBeUndefined();
  });
});
