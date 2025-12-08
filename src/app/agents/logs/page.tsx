import AgentRunLogsView, { SerializableLog } from "./logs-view";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AgentRunLogsPage() {
  const logs = await prisma.agentRunLog.findMany({
    select: {
      id: true,
      agentName: true,
      status: true,
      startedAt: true,
      user: {
        select: {
          displayName: true,
          email: true,
        },
      },
      inputSnapshot: true,
      outputSnapshot: true,
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
    userLabel: log.user?.displayName || log.user?.email || "System",
    inputSnapshot: log.inputSnapshot,
    outputSnapshot: log.outputSnapshot,
    errorMessage: log.errorMessage,
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
