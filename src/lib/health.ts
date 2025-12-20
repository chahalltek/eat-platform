import { AgentRunStatus, Prisma, prisma } from "@/server/db/prisma";
<<<<<<< ours
import { verifyLLMProvider } from "@/server/ai/gateway";
=======
import { verifyLLMProvider } from "@/lib/llm";
>>>>>>> theirs
import { getOpenAIApiKey } from "@/server/config/secrets";

export type HealthCheckName =
  | "environment"
  | "database"
  | "prisma"
  | "schema-drift"
  | "openai";

export type HealthCheckResult = {
  name: HealthCheckName;
  status: "ok" | "error" | "degraded";
  message: string;
};

export type HealthReport = {
  status: "ok" | "error" | "degraded";
  timestamp: string;
  checks: HealthCheckResult[];
};

const REQUIRED_ENVS = ["DATABASE_URL", "OPENAI_API_KEY"] as const;

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function checkRequiredEnvs(): HealthCheckResult {
  const missing = REQUIRED_ENVS.filter((key) => key !== "OPENAI_API_KEY" && !process.env[key]);

  if (!getOpenAIApiKey()) {
    missing.push("OPENAI_API_KEY");
  }

  if (missing.length > 0) {
    return {
      name: "environment",
      status: "error",
      message: `Missing required environment variables: ${missing.join(", ")}`,
    };
  }

  return {
    name: "environment",
    status: "ok",
    message: "All required environment variables are set",
  };
}

async function checkDatabase(): Promise<HealthCheckResult> {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return {
      name: "database",
      status: "ok",
      message: "Database connection successful",
    };
  } catch (error) {
    return {
      name: "database",
      status: "error",
      message: `Database unreachable: ${formatError(error)}`,
    };
  }
}

async function checkPrismaSchema(): Promise<HealthCheckResult> {
  try {
    // A schema mismatch will throw when querying a known model.
    await prisma.agentRunLog.findFirst({ select: { id: true } });

    return {
      name: "prisma",
      status: "ok",
      message: "Prisma schema is in sync",
    };
  } catch (error) {
    return {
      name: "prisma",
      status: "error",
      message: `Prisma schema mismatch: ${formatError(error)}`,
    };
  }
}

async function checkSchemaDrift(): Promise<HealthCheckResult> {
  try {
    await prisma.$queryRaw`SELECT preset FROM "TenantConfig" LIMIT 1`;

    return {
      name: "schema-drift",
      status: "ok",
      message: "Schema drift check passed",
    };
  } catch (error) {
    const errorMessage = formatError(error);
    const isMissingPresetColumn = /tenantconfig.*preset/i.test(errorMessage) || /column .*preset/i.test(errorMessage);

    if (isMissingPresetColumn) {
      return {
        name: "schema-drift",
        status: "degraded",
        message:
          "Missing column TenantConfig.preset. Apply migration 20271215144900_ensure_tenant_config_preset_column.",
      };
    }

    return {
      name: "schema-drift",
      status: "error",
      message: `Schema drift check failed: ${errorMessage}`,
    };
  }
}

async function checkOpenAI(): Promise<HealthCheckResult> {
  const apiKey = getOpenAIApiKey();

  if (!apiKey) {
    return {
      name: "openai",
      status: "error",
      message: "OPENAI_API_KEY is not configured",
    };
  }

  try {
    await verifyLLMProvider();

    return {
      name: "openai",
      status: "ok",
      message: "OpenAI is reachable and authorized",
    };
  } catch (error) {
    return {
      name: "openai",
      status: "error",
      message: `OpenAI check failed: ${formatError(error)}`,
    };
  }
}

export async function runHealthChecks(): Promise<HealthReport> {
  const checks: HealthCheckResult[] = [checkRequiredEnvs()];

  const [database, prismaSchema, schemaDrift, openai] = await Promise.all([
    checkDatabase(),
    checkPrismaSchema(),
    checkSchemaDrift(),
    checkOpenAI(),
  ]);

  checks.push(database, prismaSchema, schemaDrift, openai);

  const status = checks.every((check) => check.status === "ok")
    ? "ok"
    : checks.some((check) => check.status === "error")
      ? "error"
      : "degraded";
  const report: HealthReport = { status, timestamp: new Date().toISOString(), checks };

  console.log("[health]", JSON.stringify(report, null, 2));

  return report;
}

export async function recordHealthCheck(report: HealthReport) {
  const startedAt = Date.now();
  let runLogId: string | null = null;

  try {
    const log = await prisma.agentRunLog.create({
      data: {
        agentName: "SYSTEM.HEALTH_CHECK",
        input: report.checks as unknown as Prisma.InputJsonValue,
        inputSnapshot: report.checks as unknown as Prisma.InputJsonValue,
        status: AgentRunStatus.RUNNING,
        startedAt: new Date(startedAt),
      },
    });

    runLogId = log.id;
  } catch (error) {
    console.error("[health] Failed to create AgentRunLog entry", error);
  }

  const finishedAt = Date.now();
  const status = report.status === "ok" ? AgentRunStatus.SUCCESS : AgentRunStatus.FAILED;

  if (!runLogId) {
    return;
  }

  try {
    await prisma.agentRunLog.update({
      where: { id: runLogId },
      data: {
        status,
        output: report as unknown as Prisma.InputJsonValue,
        outputSnapshot: report as unknown as Prisma.InputJsonValue,
        durationMs: finishedAt - startedAt,
        finishedAt: new Date(finishedAt),
      },
    });
  } catch (error) {
    console.error("[health] Failed to update AgentRunLog entry", error);
  }
}
