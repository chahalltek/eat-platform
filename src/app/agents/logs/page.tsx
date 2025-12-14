import AgentRunLogsView from "./logs-view";
import { SerializableLog } from "./types";
import { FEATURE_FLAGS, isEnabled } from "@/lib/featureFlags";
import { prisma } from "@/server/db";
import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { getCurrentUser, getUserTenantId } from "@/lib/auth/user";
import { canViewAgentLogs } from "@/lib/auth/permissions";
import { ETEClientLayout } from "@/components/ETEClientLayout";

export const dynamic = "force-dynamic";

export default async function AgentRunLogsPage({
  searchParams,
}: {
  searchParams?: { agent?: string | string[] };
}) {
  const [user, tenantId] = await Promise.all([getCurrentUser(), getUserTenantId()]);
  const resolvedTenantId = tenantId ?? DEFAULT_TENANT_ID;

  if (!canViewAgentLogs(user, resolvedTenantId)) {
    return (
      <ETEClientLayout>
        <div className="mx-auto max-w-4xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-xl font-semibold">Access denied</h1>
          <p className="mt-2 text-sm text-amber-800">
            You need admin-level permissions to review agent run logs.
          </p>
        </div>
      </ETEClientLayout>
    );
  }

  const agentUiEnabled = await isEnabled(resolvedTenantId, FEATURE_FLAGS.AGENTS_MATCHED_UI_V1);

  if (!agentUiEnabled) {
    return (
      <ETEClientLayout>
        <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-900">
          <h1 className="text-xl font-semibold">Agents UI unavailable</h1>
          <p className="mt-2 text-sm text-slate-700">
            Enable the agents matched UI feature flag to access agent log details.
          </p>
        </div>
      </ETEClientLayout>
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

  const initialAgentFilter = Array.isArray(searchParams?.agent)
    ? searchParams?.agent?.[0]
    : searchParams?.agent ?? undefined;

  return (
    <ETEClientLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Agent Activity Logs</h1>
          <p className="text-gray-600">Review all agent executions and their outcomes.</p>
        </div>

        <AgentRunLogsView logs={serializableLogs} initialAgentFilter={initialAgentFilter} />
      </div>
    </ETEClientLayout>
  );
}
