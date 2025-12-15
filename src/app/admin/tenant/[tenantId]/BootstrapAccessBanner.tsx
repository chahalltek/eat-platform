import { ExclamationTriangleIcon } from "@heroicons/react/24/solid";

export function BootstrapAccessBanner({ tenantId }: { tenantId: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <div className="flex items-start gap-2">
        <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden />
        <div>
          <p className="font-semibold">Bootstrap access</p>
          <p>Global admin granted tenant admin privileges for {tenantId}.</p>
        </div>
      </div>
    </div>
  );
}
