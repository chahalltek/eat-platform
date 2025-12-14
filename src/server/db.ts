import { Prisma, PrismaClient } from "@prisma/client";

import { getCurrentTenantId } from "@/lib/tenant";

// Ensure Prisma uses the Wasm engine in tests to avoid native bindings.
if (process.env.NODE_ENV === "test" && !process.env.PRISMA_CLIENT_ENGINE_TYPE) {
  process.env.PRISMA_CLIENT_ENGINE_TYPE = "wasm";
}

const FALLBACK_DATABASE_URL = "postgresql://placeholder.invalid:5432/placeholder";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = FALLBACK_DATABASE_URL;
}

type PrismaAction =
  | "findUnique"
  | "findFirst"
  | "findMany"
  | "create"
  | "update"
  | "delete"
  | "upsert"
  | "aggregate"
  | "count"
  | "groupBy"
  | "deleteMany"
  | "updateMany";

type PrismaParams = {
  model?: string;
  action: PrismaAction | string;
  args?: Record<string, any>;
};

const TENANTED_MODELS = new Set([
  "User",
  "FeatureFlag",
  "Candidate",
  "CandidateSkill",
  "Customer",
  "JobReq",
  "JobSkill",
  "Match",
  "MatchResult",
  "AgentRunLog",
  "OutreachInteraction",
  "JobCandidate",
  "TenantSubscription",
  "SecurityEventLog",
  "AuditLog",
  "UsageEvent",
  "EatTestPlanStatus",
  "TenantConfig",
  "TenantMode",
  "DecisionStream",
  "DecisionItem",
]);

function withTenantWhere(where: Record<string, any> | undefined, tenantId: string) {
  return { ...(where ?? {}), tenantId };
}

function withTenantData(data: Record<string, any> | undefined, tenantId: string) {
  if (!data) return { tenantId };

  if (data.tenantId) return data;

  return { ...data, tenantId };
}

function scopeWhereArgs(args: Record<string, any> | undefined, tenantId: string) {
  if (!args) return { where: { tenantId } };

  if (args.where) {
    return { ...args, where: withTenantWhere(args.where, tenantId) };
  }

  return { ...args, where: { tenantId } };
}

export function applyTenantScope(params: PrismaParams, tenantId: string): PrismaParams {
  if (!params.model || !TENANTED_MODELS.has(params.model)) {
    return params;
  }

  const args = params.args ?? {};
  switch (params.action as PrismaAction) {
    case "findUnique":
      return {
        ...params,
        action: "findFirst",
        args: scopeWhereArgs(args, tenantId),
      };
    case "findFirst":
    case "findMany":
    case "aggregate":
    case "count":
    case "groupBy":
    case "deleteMany":
    case "updateMany":
    case "delete":
    case "update":
      return { ...params, args: scopeWhereArgs(args, tenantId) };
    case "create":
      return { ...params, args: { ...args, data: withTenantData(args.data, tenantId) } };
    case "upsert":
      return {
        ...params,
        args: {
          ...args,
          create: withTenantData(args.create, tenantId),
          update: withTenantData(args.update, tenantId),
        },
      };
    default:
      return params;
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const prismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
  });

const tableAvailabilityCache = new Map<string, boolean>();

export function isPrismaUnavailableError(error: unknown) {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P1001" || error.code === "P1002")
  ) {
    return true;
  }

  return false;
}

export async function isTableAvailable(tableName: string) {
  if (tableAvailabilityCache.has(tableName)) {
    return tableAvailabilityCache.get(tableName)!;
  }

  const [result] = await prismaClient
    .$queryRaw<{ exists: boolean }[]>`
      SELECT to_regclass(${`public."${tableName}"`}) IS NOT NULL AS "exists"
    `
    .catch((error) => {
      if (isPrismaUnavailableError(error)) return [];

      throw error;
    });

  const exists = Boolean(result?.exists);

  tableAvailabilityCache.set(tableName, exists);

  return exists;
}

prismaClient.$use(async (params, next) => {
  const tenantId = await getCurrentTenantId();

  const scopedParams = applyTenantScope(params, tenantId);

  return next(scopedParams as typeof params);
});

export const prisma = prismaClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "@prisma/client";
