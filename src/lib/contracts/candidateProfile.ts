import { z } from 'zod';

export const candidateProfileSkillSchema = z.object({
  name: z.string().min(1),
  normalizedName: z.string().min(1),
  proficiency: z.string().min(1).optional().nullable(),
  yearsOfExperience: z.number().int().optional().nullable(),
});

export const candidateProfileSchema = z.object({
  tenantId: z.string().min(1),
  candidateId: z.string().min(1).optional(),
  fullName: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().min(1).optional().nullable(),
  location: z.string().min(1).optional().nullable(),
  currentTitle: z.string().min(1).optional().nullable(),
  currentCompany: z.string().min(1).optional().nullable(),
  totalExperienceYears: z.number().int().optional().nullable(),
  seniorityLevel: z.string().min(1).optional().nullable(),
  normalizedSkills: z.array(candidateProfileSkillSchema),
  summary: z.string().min(1).optional().nullable(),
  trustScore: z.number().int().optional().nullable(),
  parsingConfidence: z.number().optional().nullable(),
});

export type CandidateProfileSkill = z.infer<typeof candidateProfileSkillSchema>;
export type CandidateProfile = z.infer<typeof candidateProfileSchema>;
