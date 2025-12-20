import { Prisma, PrismaClient } from "@prisma/client";

import { getCurrentTenantId } from "@/lib/tenant";

// Ensure Prisma uses the Wasm engine in tests to avoid native bindings.
if (process.env.NODE_ENV === "test" && !process.env.PRISMA_CLIENT_ENGINE_TYPE) {
  process.env.PRISMA_CLIENT_ENGINE_TYPE = "wasm";
}

const FALLBACK_DATABASE_URL = "postgresql://placeholder.invalid:5432/placeholder";

function resolveDatabaseUrl(env: NodeJS.ProcessEnv) {
  return (
    env.DATABASE_URL ??
    env.POSTGRES_PRISMA_URL ??
    env.POSTGRES_URL_NON_POOLING ??
    env.POSTGRES_URL ??
    null
  );
}

function describeDatabaseUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.host || "unknown-host";
    const databaseName = parsed.pathname?.replace(/^\//, "") || "unknown-db";

    return `${parsed.protocol}//${host}/${databaseName}`;
  } catch {
    return "an invalid DATABASE_URL";
  }
}

const resolvedDatabaseUrl = resolveDatabaseUrl(process.env);

if (resolvedDatabaseUrl) {
  process.env.DATABASE_URL = resolvedDatabaseUrl;
} else if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = FALLBACK_DATABASE_URL;
}

if (process.env.NODE_ENV !== "test") {
  if (resolvedDatabaseUrl) {
    console.log(`[startup] DATABASE_URL configured for ${describeDatabaseUrl(process.env.DATABASE_URL!)}`);
  } else {
    console.warn("[startup] DATABASE_URL is not set; using placeholder database URL.");
  }
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
  "DecisionReceipt",
  "JudgmentAggregate",
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
  "JobIntent",
  "HiringManagerBrief",
  "TenantSubscription",
  "SecurityEventLog",
  "AuditLog",
  "UsageEvent",
  "EatTestPlanStatus",
  "TenantConfig",
  "TenantMode",
  "DecisionStream",
  "DecisionItem",
  "AgentActionApproval",
  "HiringManagerFeedback",
  "ApprovalRequest",
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

export function createPrismaClient(options?: Prisma.PrismaClientOptions) {
  const { log = ["error", "warn"], ...rest } = options ?? {};

  return new PrismaClient({
    log,
    ...rest,
  });
}

const prismaClient =
  globalForPrisma.prisma ??
  createPrismaClient();

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
