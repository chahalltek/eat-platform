import { describe, expect, it } from "vitest";

import {
  assertValidCandidateProfile,
  PROFILE_PROMPT_VERSION,
  PROFILE_SYSTEM_PROMPT,
  type CandidateProfile,
} from "@/lib/agents/contracts/profileContract";

describe("CandidateProfile schema", () => {
  const validProfile: CandidateProfile = {
    fullName: "Jane Doe",
    email: "jane@example.com",
    phone: "+1234567890",
    location: "Remote",
    currentTitle: "Senior Engineer",
    currentCompany: "TechCorp",
    totalExperienceYears: 8,
    seniorityLevel: "Senior",
    summary: "Experienced engineer",
    skills: [
      {
        name: "TypeScript",
        normalizedName: "typescript",
        proficiency: "advanced",
        yearsOfExperience: 5,
      },
    ],
    parsingConfidence: 0.92,
    warnings: [],
  };

  it("accepts a valid profile payload", () => {
    expect(assertValidCandidateProfile(validProfile)).toEqual(validProfile);
  });

  it("rejects invalid profile payloads", () => {
    const invalidProfile = {
      ...validProfile,
      fullName: "",
      skills: [
        {
          name: "",
          normalizedName: "",
          proficiency: "advanced",
          yearsOfExperience: 3,
        },
      ],
      parsingConfidence: 1.5,
    } as unknown;

    expect(() => assertValidCandidateProfile(invalidProfile)).toThrow(/schema validation/i);
  });

  it("snapshots the PROFILE prompt", () => {
    expect({ version: PROFILE_PROMPT_VERSION, prompt: PROFILE_SYSTEM_PROMPT }).toMatchSnapshot(
      "PROFILE prompt contract",
    );
  });
});
