import { z } from 'zod';

export const jobIntakeSkillSchema = z.object({
  name: z.string().min(1),
  normalizedName: z.string().min(1),
  required: z.boolean().default(false),
  weight: z.number().optional().nullable(),
});

export const jobIntakeProfileSchema = z.object({
  tenantId: z.string().min(1),
  jobReqId: z.string().min(1).optional(),
  title: z.string().min(1),
  normalizedTitle: z.string().min(1),
  location: z.string().min(1).optional().nullable(),
  employmentType: z.string().min(1).optional().nullable(),
  seniorityLevel: z.string().min(1).optional().nullable(),
  skills: z.array(jobIntakeSkillSchema),
  mustHaves: z.array(z.string()),
  niceToHaves: z.array(z.string()),
  ambiguities: z.array(z.string()),
});

export type JobIntakeSkill = z.infer<typeof jobIntakeSkillSchema>;
export type JobIntakeProfile = z.infer<typeof jobIntakeProfileSchema>;
