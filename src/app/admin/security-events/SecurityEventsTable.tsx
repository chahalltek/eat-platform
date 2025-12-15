import { MonoText } from "@/components/MonoText";
import type { SecurityEventRecord } from "@/lib/audit/securityEvents";

type SecurityEventRow = Omit<SecurityEventRecord, 'createdAt'> & { createdAt: string };

type Props = {
  events: SecurityEventRow[];
};

function formatMetadata(metadata: Record<string, unknown>) {
  if (!metadata || Object.keys(metadata).length === 0) return '—';
  return JSON.stringify(metadata, null, 2);
}

export function SecurityEventsTable({ events }: Props) {
  if (!events.length) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
        No security events have been recorded yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
<<<<<<< ours
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Event</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">User</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Tenant</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Metadata</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Timestamp</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white text-sm">
          {events.map((event) => (
            <tr key={event.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{event.eventType}</td>
              <td className="px-4 py-3 text-gray-700">
                <MonoText className="text-xs text-gray-700">
                  {event.userId ?? 'User not recorded'}
                </MonoText>
              </td>
              <td className="px-4 py-3 text-gray-700">
                <MonoText className="text-xs text-gray-700">{event.tenantId}</MonoText>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-pre-wrap break-words">
                {formatMetadata(event.metadata)}
              </td>
              <td className="px-4 py-3 text-gray-600">{new Date(event.createdAt).toLocaleString()}</td>
=======
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Event</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">User</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Tenant</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Metadata</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Timestamp</th>
>>>>>>> theirs
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white text-sm">
            {events.map((event) => (
              <tr key={event.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{event.eventType}</td>
                <td className="px-4 py-3 text-gray-700">{event.userId ?? 'User not recorded'}</td>
                <td className="px-4 py-3 text-gray-700">{event.tenantId}</td>
                <td className="px-4 py-3 align-top text-gray-700">
                  <div className="max-w-3xl whitespace-pre-wrap break-words font-mono text-xs text-gray-600 leading-snug line-clamp-2">
                    {formatMetadata(event.metadata)}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{new Date(event.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
