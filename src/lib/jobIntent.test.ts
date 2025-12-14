import { describe, expect, it } from "vitest";

import { applyJobIntent, buildJobIntentPayload, parseJobIntentPayload } from "@/lib/jobIntent";
import type { JobIntentPayload } from "@/types/jobIntent";

describe("jobIntent helpers", () => {
  it("builds a normalized intent payload from inputs", () => {
    const payload = buildJobIntentPayload({
      title: "Frontend Engineer",
      location: "Remote",
      employmentType: "FULL_TIME",
      seniorityLevel: "MID",
      skills: [
        { name: "React", normalizedName: "react", required: true },
        { name: "GraphQL", normalizedName: "graphql", required: false },
      ],
    });

    expect(payload.summary).toBe("Frontend Engineer");
    expect(payload.metadata?.createdFrom).toBe("intake");
    expect(payload.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "skill", label: "React", required: true, normalizedLabel: "react" }),
        expect.objectContaining({ type: "skill", label: "GraphQL", required: false, normalizedLabel: "graphql" }),
        expect.objectContaining({ type: "location", label: "Remote" }),
        expect.objectContaining({ type: "seniority", label: "MID" }),
        expect.objectContaining({ type: "employmentType", label: "FULL_TIME" }),
        expect.objectContaining({ type: "summary", label: "Frontend Engineer" }),
      ]),
    );
  });

  it("parses stored intent payloads and filters invalid requirements", () => {
    const parsed = parseJobIntentPayload({
      summary: "Backend Engineer",
      requirements: [
        { label: "Backend", type: "skill", skills: [{ name: "Go", normalizedName: "go", required: true }] },
        null,
      ],
    });

    expect(parsed?.requirements).toHaveLength(1);
    expect(parsed?.requirements[0]).toMatchObject({
      label: "Backend",
      type: "skill",
    });
  });

  it("applies job intent payloads to job requirements when present", () => {
    const jobIntent: { intent: JobIntentPayload } = {
      intent: {
        requirements: [
          {
            label: "UI",
            skills: [
              { name: "React", normalizedName: "react", required: true, weight: 2 },
              { name: "TypeScript", normalizedName: "typescript", required: false, weight: 1 },
            ],
          },
        ],
      },
    };

    const jobReq = {
      id: "job-1",
      tenantId: "tenant-1",
      jobIntent,
      skills: [
        { name: "React", normalizedName: "react", required: true, weight: 2 },
        { name: "TypeScript", normalizedName: "typescript", required: false, weight: 1 },
      ],
    };

    const result = applyJobIntent(jobReq as any, jobIntent as any);

    expect(result.skills).toEqual(jobIntent.intent.requirements[0].skills);
  });
});
