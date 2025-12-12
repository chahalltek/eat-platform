import Link from "next/link";

export function FireDrillBanner({ maxWidthClassName = "max-w-6xl" }: { maxWidthClassName?: string }) {
  return (
    <div className="border-b border-amber-300 bg-amber-600 text-white" role="alert" aria-live="polite">
      <div className={`mx-auto flex items-start justify-between gap-4 px-6 py-3 ${maxWidthClassName}`}>
        <div className="flex items-start gap-3">
          <span className="text-xl" aria-hidden>
            🔥
          </span>
          <div className="flex flex-col">
            <p className="text-sm font-semibold">Fire Drill is active</p>
            <p className="text-xs text-amber-50">
              Only essential agents are enabled. Explain and Confidence agents are paused and guardrails are locked until Fire
              Drill is turned off.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide">
          <details className="group text-right">
            <summary className="cursor-pointer text-amber-50 underline decoration-amber-100/70 underline-offset-4 transition hover:text-white">
              Learn more
            </summary>
            <div className="mt-2 max-w-xs rounded-lg bg-amber-500/40 px-3 py-2 text-left text-[11px] leading-relaxed text-amber-50 shadow-inner">
              Fire drills keep humans in the loop while you investigate. Switch back to Pilot, Production, or Sandbox when you’re
              ready to resume normal operations.
            </div>
          </details>
          <Link
            href="/admin/tenants"
            className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:bg-white/25"
          >
            Exit Fire Drill
          </Link>
        </div>
      </div>
    </div>
  );
}
