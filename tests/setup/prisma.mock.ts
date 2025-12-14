import { vi } from "vitest";

import { mockDb } from "@/test-helpers/db";

vi.mock("@prisma/client", async () => {
  const actual = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");

  const pickEnum = <T>(primary?: T, prismaEnum?: T, fallback?: T): T | undefined =>
    primary ?? prismaEnum ?? fallback;

  const fallbackEnums = {
    HiringManagerFeedbackType: {
      REQUIREMENT_CHANGED: "REQUIREMENT_CHANGED",
      CANDIDATE_REJECTED: "CANDIDATE_REJECTED",
      CANDIDATE_UPDATED: "CANDIDATE_UPDATED",
      THRESHOLD_ADJUSTED: "THRESHOLD_ADJUSTED",
    },
    HiringManagerFeedbackStatus: {
      SUBMITTED: "SUBMITTED",
      PROCESSED: "PROCESSED",
    },
  } as const;

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
    // Ensure enum exports are available when mocked so tests can import them directly.
    JobCandidateStatus: pickEnum((actual as any).JobCandidateStatus, (actual as any).Prisma?.JobCandidateStatus),
    AgentRunStatus: pickEnum((actual as any).AgentRunStatus, (actual as any).Prisma?.AgentRunStatus),
    TenantDeletionMode: pickEnum((actual as any).TenantDeletionMode, (actual as any).Prisma?.TenantDeletionMode),
    HiringManagerFeedbackType: pickEnum(
      (actual as any).HiringManagerFeedbackType,
      (actual as any).Prisma?.HiringManagerFeedbackType,
      fallbackEnums.HiringManagerFeedbackType,
    ),
    HiringManagerFeedbackStatus: pickEnum(
      (actual as any).HiringManagerFeedbackStatus,
      (actual as any).Prisma?.HiringManagerFeedbackStatus,
      fallbackEnums.HiringManagerFeedbackStatus,
    ),
    PrismaClient,
  };
});

mockDb();
