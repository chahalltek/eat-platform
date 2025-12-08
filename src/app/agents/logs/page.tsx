import AgentRunLogsView from "./logs-view";
import { SerializableLog } from "./types";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getUserTenantId } from "@/lib/auth/user";
import { canViewAgentLogs } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export default async function AgentRunLogsPage() {
  const [user, tenantId] = await Promise.all([getCurrentUser(), getUserTenantId()]);

  if (!canViewAgentLogs(user, tenantId)) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-xl font-semibold">Access denied</h1>
          <p className="mt-2 text-sm text-amber-800">
            You need admin-level permissions to review agent run logs.
          </p>
        </div>
      </div>
    );
  }

  const logs = await prisma.agentRunLog.findMany({
    select: {
      id: true,
      agentName: true,
      status: true,
      startedAt: true,
      finishedAt: true,
      durationMs: true,
      user: {
        select: {
          displayName: true,
          email: true,
        },
      },
      inputSnapshot: true,
      outputSnapshot: true,
      output: true,
      errorMessage: true,
      retryCount: true,
      retryOfId: true,
    },
    orderBy: { startedAt: "desc" },
    take: 100,
  });

  const serializableLogs: SerializableLog[] = logs.map((log) => ({
    id: log.id,
    agentName: log.agentName,
    status: log.status,
    startedAt: log.startedAt.toISOString(),
    finishedAt: log.finishedAt?.toISOString() ?? null,
    durationMs:
      log.durationMs ?? (log.finishedAt ? Math.max(0, log.finishedAt.getTime() - log.startedAt.getTime()) : null),
    userLabel: log.user?.displayName || log.user?.email || "System",
    inputSnapshot: log.inputSnapshot,
    outputSnapshot: log.outputSnapshot,
    errorMessage: log.errorMessage,
    errorCategory:
      typeof log.output === "object" && log.output !== null && "errorCategory" in log.output
        ? (log.output as { errorCategory?: SerializableLog["errorCategory"] }).errorCategory ?? null
        : null,
    retryCount: log.retryCount,
    retryOfId: log.retryOfId,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Agent Activity Logs</h1>
        <p className="text-gray-600">Review all agent executions and their outcomes.</p>
      </div>

      <AgentRunLogsView logs={serializableLogs} />
    </div>
  );
}
