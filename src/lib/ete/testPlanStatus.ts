import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { prisma } from "@/server/db/prisma";

import { TEST_PLAN_STATUS_OPTIONS, type TestPlanStatusValue, isValidTestPlanItemId } from "./testPlanRegistry";

export type TestPlanStatusRecord = {
  itemId: string;
  status: TestPlanStatusValue;
  note: string | null;
  updatedBy: string;
  updatedAt: Date;
};

export type TestPlanStatusMap = Record<string, TestPlanStatusRecord>;

const STATUS_VALUES = new Set(TEST_PLAN_STATUS_OPTIONS.map((option) => option.value));

type TestPlanStatusModel = {
  findMany: (args: unknown) => Promise<
    Array<{ itemId: string; status: string; note: string | null; updatedBy: string; updatedAt: Date }>
  >;
  upsert: (args: unknown) => Promise<{ itemId: string; status: string; note: string | null; updatedBy: string; updatedAt: Date }>;
};

function getTestPlanModel(): TestPlanStatusModel | null {
  const model = (prisma as unknown as { eatTestPlanStatus?: TestPlanStatusModel }).eatTestPlanStatus;

  return model ?? null;
}

export function parseTestPlanStatus(value: unknown): TestPlanStatusValue | null {
  if (typeof value !== "string") return null;
  return STATUS_VALUES.has(value as TestPlanStatusValue) ? (value as TestPlanStatusValue) : null;
}

export async function listTestPlanStatuses(tenantId: string | null | undefined): Promise<TestPlanStatusMap> {
  const resolvedTenantId = tenantId?.trim() || DEFAULT_TENANT_ID;
  const model = getTestPlanModel();

  if (!model) {
    return {};
  }

  const statuses = await model.findMany({ where: { tenantId: resolvedTenantId } });

  return statuses.reduce<TestPlanStatusMap>((acc, status) => {
    acc[status.itemId] = {
      itemId: status.itemId,
      status: status.status as TestPlanStatusValue,
      note: status.note ?? null,
      updatedBy: status.updatedBy,
      updatedAt: status.updatedAt,
    };
    return acc;
  }, {});
}

export async function upsertTestPlanStatus(params: {
  tenantId: string | null | undefined;
  itemId: string;
  status: TestPlanStatusValue;
  note?: string | null;
  updatedBy: string;
}): Promise<TestPlanStatusRecord> {
  const resolvedTenantId = params.tenantId?.trim() || DEFAULT_TENANT_ID;

  const model = getTestPlanModel();

  if (!model) {
    throw new Error("Test plan status storage unavailable");
  }

  if (!isValidTestPlanItemId(params.itemId)) {
    throw new Error(`Unknown test plan item: ${params.itemId}`);
  }

  if (!STATUS_VALUES.has(params.status)) {
    throw new Error(`Unsupported status: ${params.status}`);
  }

  const sanitizedNote = params.note?.trim() || null;

  const record = await model.upsert({
    where: { tenantId_itemId: { tenantId: resolvedTenantId, itemId: params.itemId } },
    create: {
      itemId: params.itemId,
      status: params.status,
      note: sanitizedNote,
      updatedBy: params.updatedBy,
      tenantId: resolvedTenantId,
    },
    update: {
      status: params.status,
      note: sanitizedNote,
      updatedBy: params.updatedBy,
    },
  });

  return {
    itemId: record.itemId,
    status: record.status as TestPlanStatusValue,
    note: record.note ?? null,
    updatedBy: record.updatedBy,
    updatedAt: record.updatedAt,
  };
}
