import type { ReactNode } from 'react';

import { getCurrentUser } from '@/lib/auth/user';
import { getEnvironmentSnapshot, type EnvEntry } from '@/lib/admin/env';

export const dynamic = 'force-dynamic';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {children}
      </div>
    </section>
  );
}

function EnvTable({ entries }: { entries: EnvEntry[] }) {
  if (entries.length === 0) {
    return <p className="px-4 py-6 text-sm text-gray-500">No entries found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-left text-sm text-gray-700">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold text-gray-900">
              Key
            </th>
            <th scope="col" className="px-4 py-3 font-semibold text-gray-900">
              Value
            </th>
            <th scope="col" className="px-4 py-3 font-semibold text-gray-900">
              Visibility
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map((entry) => (
            <tr key={entry.key} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-mono text-xs text-gray-700">{entry.key}</td>
              <td className="px-4 py-3 font-mono text-xs text-gray-900">
                {entry.value ?? '—'}
              </td>
              <td className="px-4 py-3 text-gray-600">{entry.redacted ? 'Redacted' : 'Visible'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VersionList({
  versions,
}: {
  versions: { appVersion: string; nextVersion?: string; prismaVersion?: string; nodeVersion: string };
}) {
  const items = [
    { label: 'App Version', value: versions.appVersion },
    { label: 'Next.js', value: versions.nextVersion },
    { label: 'Prisma', value: versions.prismaVersion },
    { label: 'Node', value: versions.nodeVersion },
  ].filter((item) => item.value);

  return (
    <dl className="divide-y divide-gray-100">
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between px-4 py-3 text-sm">
          <dt className="text-gray-600">{item.label}</dt>
          <dd className="font-medium text-gray-900">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function AdminEnvPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-5 text-red-900">
          <h1 className="text-xl font-semibold">Access denied</h1>
          <p className="mt-2 text-sm text-red-800">
            You must be an administrator to view environment details.
          </p>
        </div>
      </div>
    );
  }

  const snapshot = getEnvironmentSnapshot();

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-indigo-600">Admin</p>
        <h1 className="text-3xl font-semibold text-gray-900">Environment Overview</h1>
        <p className="max-w-2xl text-sm text-gray-600">
          Read-only snapshot of runtime environment variables, feature flags, and versions. Sensitive values are
          automatically redacted.
        </p>
      </header>

      <Section title="Runtime Environment">
        <EnvTable entries={snapshot.runtimeEnv} />
      </Section>

      <Section title="Feature Flags">
        <EnvTable entries={snapshot.flags} />
      </Section>

      <Section title="Versions">
        <VersionList versions={snapshot.versions} />
      </Section>
    </div>
  );
}
