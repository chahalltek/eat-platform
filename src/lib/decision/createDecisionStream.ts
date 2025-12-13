import { prisma } from '../prisma';

export type CreateDecisionStreamInput = {
  jobId: string;
  createdBy: string;
};

export async function createDecisionStream({
  jobId,
  createdBy,
}: CreateDecisionStreamInput) {
  const existingStream = await prisma.decisionStream.findFirst({
    where: {
      jobId,
      createdBy,
      status: 'active',
    },
  });

  if (existingStream) {
    return existingStream;
  }

  return prisma.decisionStream.create({
    data: {
      jobId,
      createdBy,
      status: 'active',
    },
  });
}
