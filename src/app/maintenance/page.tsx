export default function MaintenancePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-16 text-slate-900">
      <div className="w-full max-w-xl space-y-6 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <span className="text-3xl" aria-hidden>
            🛠️
          </span>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-600">Maintenance Mode</p>
          <h1 className="text-3xl font-semibold text-slate-900">We&apos;ll be right back</h1>
          <p className="text-sm text-slate-600">
            The platform is temporarily offline while we perform scheduled maintenance. Please check back soon or contact
            your administrator if you need urgent access.
          </p>
        </div>
      </div>
    </main>
  );
}
