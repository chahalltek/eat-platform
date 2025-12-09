import { z } from 'zod';

import { candidateProfileSchema } from './candidateProfile';
import { jobIntakeProfileSchema } from './jobIntake';

export const matchScoreBreakdownSchema = z.object({
  skillScore: z.number(),
  seniorityScore: z.number().optional().nullable(),
  locationScore: z.number().optional().nullable(),
  candidateSignalScore: z.number().optional().nullable(),
  experienceScore: z.number().optional().nullable(),
  compensationScore: z.number().optional().nullable(),
  availabilityScore: z.number().optional().nullable(),
  cultureScore: z.number().optional().nullable(),
  additionalScores: z.record(z.string(), z.number()).optional().nullable(),
});

export const matchResultViewSchema = z.object({
  jobReq: jobIntakeProfileSchema,
  candidate: candidateProfileSchema,
  overallScore: z.number(),
  breakdown: matchScoreBreakdownSchema,
  category: z.string().min(1),
  createdByAgent: z.boolean().default(false),
});

export type MatchScoreBreakdown = z.infer<typeof matchScoreBreakdownSchema>;
export type MatchResultView = z.infer<typeof matchResultViewSchema>;
