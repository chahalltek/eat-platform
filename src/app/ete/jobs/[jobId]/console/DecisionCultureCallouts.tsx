import { LightBulbIcon } from "@heroicons/react/24/outline";

import type { DecisionCultureCue } from "@/lib/judgmentMemory/culturalCues";

export function DecisionCultureCallouts({ cues }: { cues: DecisionCultureCue[] }) {
  if (!cues.length) return null;

  return (
    <div className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-indigo-900 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-200 text-indigo-900">
          <LightBulbIcon className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">This is how we decide here</p>
          <p className="text-xs text-indigo-800">Aggregated, anonymized cues scoped to this job.</p>
        </div>
      </div>

      <ul className="mt-3 space-y-3">
        {cues.map((cue) => (
          <li
            key={`${cue.scope}-${cue.sampleSize}-${cue.message.slice(0, 18)}`}
            className="rounded-xl bg-white/80 px-4 py-3 text-sm shadow-sm ring-1 ring-indigo-100"
          >
            <p className="font-semibold text-indigo-950">{cue.message}</p>
            <p className="text-[11px] text-indigo-800/80">
              Based on {cue.sampleSize} decisions • {cue.windowLabel}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
