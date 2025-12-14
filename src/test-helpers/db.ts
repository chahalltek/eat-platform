import { vi } from "vitest";

type MockFn = ReturnType<typeof vi.fn>;

type PrismaModelMock = {
  findMany: MockFn;
  findUnique: MockFn;
  findUniqueOrThrow: MockFn;
  findFirst: MockFn;
  findFirstOrThrow: MockFn;
  create: MockFn;
  createMany: MockFn;
  update: MockFn;
  updateMany: MockFn;
  upsert: MockFn;
  delete: MockFn;
  deleteMany: MockFn;
  count: MockFn;
  aggregate: MockFn;
  groupBy: MockFn;
};

const createModelMock = (): PrismaModelMock => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  findFirst: vi.fn(),
  findFirstOrThrow: vi.fn(),
  create: vi.fn(),
  createMany: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
  count: vi.fn(),
  aggregate: vi.fn(),
  groupBy: vi.fn(),
});

const createPrismaMock = () => {
  const prisma: Record<string, PrismaModelMock | MockFn> = {
    agentRunLog: createModelMock(),
    auditLog: createModelMock(),
    candidate: createModelMock(),
    candidateSkill: createModelMock(),
    customer: createModelMock(),
    decisionItem: createModelMock(),
    decisionStream: createModelMock(),
    eatTestPlanStatus: createModelMock(),
    featureFlag: createModelMock(),
    job: createModelMock(),
    jobApplication: createModelMock(),
    jobApplicationEvent: createModelMock(),
    jobApplicationScore: createModelMock(),
    jobCandidate: createModelMock(),
    jobReq: createModelMock(),
    jobSkill: createModelMock(),
    match: createModelMock(),
    matchResult: createModelMock(),
    outreachInteraction: createModelMock(),
    securityEventLog: createModelMock(),
    tenant: createModelMock(),
    tenantConfig: createModelMock(),
    tenantMode: createModelMock(),
    tenantSubscription: createModelMock(),
    tenantUser: createModelMock(),
    usageEvent: createModelMock(),
    user: createModelMock(),
    $transaction: vi.fn(async (fn: any) => fn(prisma)),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };

  return prisma;
};

const prismaMock = createPrismaMock();

function resetModelMock(model: PrismaModelMock) {
  Object.values(model).forEach((fn) => fn.mockReset());
}

function resetPrismaMock() {
  Object.values(prismaMock).forEach((entry) => {
    if (typeof entry === "function" && "mockReset" in entry) {
      (entry as MockFn).mockReset();
      return;
    }

    resetModelMock(entry as PrismaModelMock);
  });
}

export function mockDb() {
  vi.mock("@/server/db", async (importOriginal) => {
    const previousAllowConstruction = process.env.VITEST_PRISMA_ALLOW_CONSTRUCTION;
    process.env.VITEST_PRISMA_ALLOW_CONSTRUCTION = "true";

    const actual = await importOriginal<typeof import("@/server/db")>();

    process.env.VITEST_PRISMA_ALLOW_CONSTRUCTION = previousAllowConstruction;

    return {
      ...actual,
      prisma: prismaMock as unknown as typeof actual.prisma,
      isPrismaUnavailableError: vi.fn(() => false),
      isTableAvailable: vi.fn(async () => true),
    };
  });

  return { prisma: prismaMock, resetDbMocks: resetPrismaMock } as const;
}

export type MockDb = ReturnType<typeof mockDb>;
export const prismaMockInstance = prismaMock;
export const resetDbMocks = resetPrismaMock;
