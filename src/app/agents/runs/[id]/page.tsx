import { prisma } from '@/lib/prisma';

function formatDateTime(value?: Date | null) {
  if (!value) return '—';
  return value.toLocaleString();
}

function formatDurationMs(startedAt: Date, finishedAt?: Date | null) {
  if (!finishedAt) return 'In progress';
  const duration = finishedAt.getTime() - startedAt.getTime();
  return `${duration} ms`;
}

export default async function AgentRunDetail({
  params,
}: {
  params: { id: string };
}) {
  const run = await prisma.agentRunLog.findUnique({
    where: { id: params.id },
  });

  if (!run) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Agent Run</h1>
        <p className="mt-2 text-gray-600">Not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Agent Run Detail</h1>
        <p className="text-gray-600">ID: {run.id}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 p-4 sm:grid-cols-2">
        <div>
          <div className="text-sm text-gray-500">Agent Name</div>
          <div className="text-lg font-medium">{run.agentName}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Status</div>
          <div className="text-lg font-medium">{run.status}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Started At</div>
          <div className="text-lg font-medium">{formatDateTime(run.startedAt)}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Finished At</div>
          <div className="text-lg font-medium">{formatDateTime(run.finishedAt)}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Duration</div>
          <div className="text-lg font-medium">
            {formatDurationMs(run.startedAt, run.finishedAt)}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Input Snapshot</h2>
        <pre className="overflow-x-auto rounded-lg bg-gray-100 p-4 text-sm">{JSON.stringify(run.input, null, 2)}</pre>
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Output Snapshot</h2>
        <pre className="overflow-x-auto rounded-lg bg-gray-100 p-4 text-sm">{run.output ? JSON.stringify(run.output, null, 2) : '—'}</pre>
      </div>
    </div>
  );
}
