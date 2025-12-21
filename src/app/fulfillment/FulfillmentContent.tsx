"use client";

type FulfillmentContentProps = {
  canPublish: boolean;
};

export function FulfillmentContent({ canPublish }: FulfillmentContentProps) {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Fulfillment</p>
        <h1 className="text-2xl font-semibold text-zinc-900">Runbook and controls</h1>
        <p className="text-sm text-zinc-600">Review fulfillment state and publish updates.</p>
      </header>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Latest release</h2>
            <p className="text-sm text-zinc-600">Only users with publish permissions can push a new fulfillment release.</p>
          </div>
          {canPublish ? (
            <button className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
              Publish
            </button>
          ) : null}
        </div>
        <div className="mt-4 rounded-lg bg-zinc-50 p-4 text-sm text-zinc-700">
          <p className="font-semibold text-zinc-900">Fulfillment status</p>
          <p className="text-zinc-600">All agents healthy. No pending actions.</p>
        </div>
      </div>
    </div>
  );
}
