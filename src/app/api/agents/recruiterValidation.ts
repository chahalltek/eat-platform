import { prisma } from '@/server/db';
import { getCurrentTenantId } from '@/lib/tenant';

export type RecruiterValidationResult =
  | { recruiterId: string | null }
  | { error: string; status: number };

export async function validateRecruiterId(
  recruiterId: unknown,
  { required = false }: { required?: boolean } = {},
): Promise<RecruiterValidationResult> {
  const trimmedRecruiterId = typeof recruiterId === 'string' ? recruiterId.trim() : '';

  if (!trimmedRecruiterId) {
    if (required) {
      return { error: 'recruiterId is required and must be a string', status: 400 };
    }

    return { recruiterId: null };
  }

  const tenantId = await getCurrentTenantId();

  const user = await prisma.user.findUnique({
    where: { id: trimmedRecruiterId, tenantId },
    select: { id: true },
  });

  if (!user) {
    return { error: 'Recruiter not found', status: 404 };
  }

  return { recruiterId: user.id };
}
