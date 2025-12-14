import { vi } from "vitest";

import { mockDb } from "@/test-helpers/db";

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

mockDb();
