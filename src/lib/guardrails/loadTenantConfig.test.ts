import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultTenantGuardrails } from "./defaultTenantConfig";
import { loadTenantConfig } from "./loadTenantConfig";

const { mockFindUnique } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    tenantConfig: {
      findUnique: mockFindUnique,
    },
  },
}));

describe("loadTenantConfig", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back to defaults when the preset column is missing", async () => {
    const missingColumnError = new Prisma.PrismaClientKnownRequestError(
      "Missing column preset",
      {
        code: "P2022",
        clientVersion: "5.19.0",
        meta: { column: "TenantConfig.preset" },
      },
    );

    mockFindUnique.mockRejectedValueOnce(missingColumnError);

    const result = await loadTenantConfig("tenant-123");

    expect(result).toMatchObject({
      ...defaultTenantGuardrails,
      preset: null,
      _source: "default",
    });
  });
});
