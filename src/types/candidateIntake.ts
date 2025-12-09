import { z } from "zod";

export const candidateSkillSchema = z.object({
  name: z.string().min(1),
  normalizedName: z.string().min(1).optional(),
  proficiency: z.string().optional(),
  yearsOfExperience: z.number().int().nonnegative().nullable().optional(),
});

export const candidateProfileSchema = z.object({
  fullName: z.string().min(1),
  currentTitle: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  seniorityLevel: z.string().nullable().optional(),
  totalExperienceYears: z.number().int().nonnegative().nullable().optional(),
  summary: z.string().nullable().optional(),
  parsingConfidence: z.number().min(0).max(1).nullable().optional(),
  skills: z.array(candidateSkillSchema).default([]),
  rawResumeText: z.string().optional(),
});

export type CandidateProfile = z.infer<typeof candidateProfileSchema>;
export type CandidateSkill = z.infer<typeof candidateSkillSchema>;
