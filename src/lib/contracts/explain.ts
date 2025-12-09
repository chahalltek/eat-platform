import { z } from 'zod';

export const matchExplanationSchema = z.object({
  matchId: z.string().min(1).optional(),
  matchResultId: z.string().min(1).optional(),
  summary: z.string().min(1),
  strengths: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  reasoningTrace: z.array(z.string()).default([]),
});

export type MatchExplanation = z.infer<typeof matchExplanationSchema>;
