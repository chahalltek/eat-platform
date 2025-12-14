import { vi } from "vitest";

vi.mock("@prisma/client", async () => {
  const actual = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");

  class PrismaClient {
    $connect = vi.fn();
    $disconnect = vi.fn();
    $queryRaw = vi.fn(async () => []);
    $transaction = vi.fn();
    $use = vi.fn();

    constructor() {
      if (process.env.VITEST_PRISMA_ALLOW_CONSTRUCTION !== "true") {
        throw new Error(
          "PrismaClient should never be constructed in unit tests. Import prisma from src/server/db and mock it.",
        );
      }
    }
  }

  return {
    ...actual,
    PrismaClient,
  };
});

vi.mock("@/server/db", async () => {
  const previousAllowConstruction = process.env.VITEST_PRISMA_ALLOW_CONSTRUCTION;
  process.env.VITEST_PRISMA_ALLOW_CONSTRUCTION = "true";

  const actual = await vi.importActual<typeof import("@/server/db")>("@/server/db");

  process.env.VITEST_PRISMA_ALLOW_CONSTRUCTION = previousAllowConstruction;

  const createModelMock = () => ({
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  });

  const prisma = {
    job: createModelMock(),
    candidate: createModelMock(),
    user: createModelMock(),
    agentRunLog: createModelMock(),
    jobApplication: createModelMock(),
    jobApplicationScore: createModelMock(),
    jobApplicationEvent: createModelMock(),
    tenant: createModelMock(),
    auditLog: createModelMock(),
    decisionStream: createModelMock(),
    decisionItem: createModelMock(),
    featureFlag: createModelMock(),
    $transaction: vi.fn(async (fn: any) => fn(prisma)),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  } as const;

  return {
    ...actual,
    prisma,
    isPrismaUnavailableError: vi.fn(() => false),
    isTableAvailable: vi.fn(async () => true),
  };
});
