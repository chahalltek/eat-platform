import { StatusBadge, type StatusVariant } from "@/components/table/tableTypes";

const BADGE_VARIANTS: { variant: StatusVariant; label: string; description: string }[] = [
  { variant: "success", label: "Healthy", description: "Background tasks are flowing normally." },
  { variant: "info", label: "Informational", description: "Analytics are updating in the background." },
  { variant: "warning", label: "Needs attention", description: "There is a configuration that needs review." },
  { variant: "error", label: "Action required", description: "A blocking error is preventing processing." },
  { variant: "neutral", label: "Idle", description: "No recent events have been recorded." },
];

export default function StatusBadgeShowcasePage() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Components
          </p>
          <h1 className="text-3xl font-bold leading-tight">Status badge contrast</h1>
          <p className="max-w-3xl text-base text-slate-600 dark:text-slate-300">
            Snapshot-friendly view of the status badge component in light and dark color schemes. The badges below should
            stay legible against both backgrounds and keep their semantic color cues.
          </p>
        </header>

        <section
          className="grid gap-4 rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/60"
          data-testid="status-badge-gallery"
        >
          <div className="flex flex-wrap gap-3">
            {BADGE_VARIANTS.map(({ variant, label }) => (
              <StatusBadge key={variant} variant={variant} label={label} />
            ))}
          </div>

          <dl className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200 sm:grid-cols-2">
            {BADGE_VARIANTS.map(({ variant, description }) => (
              <div key={variant} className="space-y-1 rounded-lg border border-slate-200/70 p-3 dark:border-slate-800">
                <dt className="font-semibold capitalize text-slate-700 dark:text-slate-50">{variant}</dt>
                <dd className="text-slate-500 dark:text-slate-300">{description}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </main>
  );
}
