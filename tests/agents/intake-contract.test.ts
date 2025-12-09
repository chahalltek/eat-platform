import { describe, expect, it } from "vitest";

import {
  assertValidJobIntakeProfile,
  type JobIntakeProfile,
} from "@/lib/agents/contracts/intakeContract";

const validProfile: JobIntakeProfile = {
  clientName: "ClientCo",
  title: "Senior Engineer",
  seniorityLevel: "Senior",
  location: "Remote",
  remoteType: "Fully remote",
  employmentType: "Full-time",
  responsibilitiesSummary: "Build things",
  teamContext: "Platform team",
  priority: "High",
  status: "Open",
  ambiguityScore: 0.2,
  skills: [
    { name: "TypeScript", normalizedName: "typescript", isMustHave: true },
    { name: "React", normalizedName: "react", isMustHave: false },
  ],
};

describe("JobIntakeProfile schema", () => {
  it("accepts a valid profile", () => {
    expect(assertValidJobIntakeProfile(validProfile)).toEqual(validProfile);
  });

  it("rejects missing required fields", () => {
    const badProfile = { ...validProfile } as Partial<JobIntakeProfile>;
    // @ts-expect-error: force missing title
    delete badProfile.title;

    expect(() => assertValidJobIntakeProfile(badProfile)).toThrow(
      /failed schema validation/i,
    );
  });

  it("rejects invalid skill entries", () => {
    const badSkillProfile = {
      ...validProfile,
      skills: [
        { name: "TypeScript", normalizedName: "typescript", isMustHave: true },
        // @ts-expect-error: invalid must-have type
        { name: "React", normalizedName: "react", isMustHave: "yes" },
      ],
    } satisfies Partial<JobIntakeProfile>;

    expect(() => assertValidJobIntakeProfile(badSkillProfile)).toThrow(
      /failed schema validation/i,
    );
  });
});
