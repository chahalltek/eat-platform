'use client';

import clsx from "clsx";

import { useOpsImpactOverlay } from "./OpsImpactOverlayContext";
import { impactClassStyles, opsImpactOverlayByNodeId, type ImpactClass } from "./impactOverlayData";

type SystemNode = {
  id: string;
  name: string;
  type: string;
  summary: string;
  tags: readonly string[];
};

function ImpactBadge({
  impactClass,
  isPinned,
}: {
  impactClass: ImpactClass;
  isPinned: boolean;
}) {
  const styles = impactClassStyles[impactClass];

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ring-1 transition",
        styles.badge,
        isPinned ? "ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900" : "hover:brightness-95",
      )}
    >
      <span className={clsx("h-1.5 w-1.5 rounded-full", styles.accentDot)} aria-hidden />
      {impactClass}
      {isPinned ? <span className="text-[9px] font-semibold text-indigo-700 dark:text-indigo-200">(Pinned)</span> : null}
    </span>
  );
}

export function SystemNodesGrid({ nodes }: { nodes: readonly SystemNode[] }) {
  const { enabled, setHoveredNodeId, togglePinnedNodeId, activeNodeId, pinnedNodeId } = useOpsImpactOverlay();

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {nodes.map((node) => {
        const overlay = opsImpactOverlayByNodeId[node.id];
        const isActive = activeNodeId === node.id;
        const isPinned = pinnedNodeId === node.id;
        const styles = overlay ? impactClassStyles[overlay.impactClass] : null;

        return (
          <div
            key={node.id}
            className={clsx(
              "relative flex h-full flex-col gap-3 rounded-2xl border bg-white/90 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-zinc-900/80",
              overlay && enabled && styles ? styles.border : "border-indigo-100 dark:border-indigo-800",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">{node.type}</p>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{node.name}</h3>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-900/50 dark:text-indigo-200 dark:ring-indigo-700/50">
                  Node
                </span>
                {enabled && overlay ? (
                  <button
                    type="button"
                    className="focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-900"
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    onFocus={() => setHoveredNodeId(node.id)}
                    onBlur={() => setHoveredNodeId(null)}
                    onClick={() => togglePinnedNodeId(node.id)}
                    aria-pressed={isPinned}
                    aria-expanded={isActive}
                  >
                    <ImpactBadge impactClass={overlay.impactClass} isPinned={isPinned} />
                  </button>
                ) : null}
              </div>
            </div>
            <p className="text-sm leading-relaxed text-zinc-700 line-clamp-3 dark:text-zinc-300">{node.summary}</p>
            {node.id === "confidence" ? (
              <div className="rounded-lg border border-indigo-100 bg-indigo-50/70 p-3 text-xs leading-relaxed text-indigo-900 dark:border-indigo-800/60 dark:bg-indigo-900/40 dark:text-indigo-100/80">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-700 dark:text-indigo-300">Why this matters</p>
                <p className="mt-1 text-indigo-900/80 dark:text-indigo-100/80">
                  This is where decisions become explainable, defensible, and auditable — turning outcomes into durable organizational memory.
                </p>
              </div>
            ) : null}
            <div className="mt-auto flex flex-wrap gap-2">
              {node.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-200 dark:ring-indigo-800/60"
                >
                  {tag}
                </span>
              ))}
            </div>

            {enabled && overlay ? (
              <div
                className={clsx(
                  "absolute inset-x-4 bottom-4 z-10 translate-y-1 rounded-2xl bg-white/95 p-4 text-sm leading-relaxed shadow-lg ring-1 ring-indigo-100 transition duration-150 dark:bg-zinc-900/95 dark:ring-indigo-800/50",
                  isActive ? "opacity-100" : "pointer-events-none opacity-0",
                )}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
              >
                <div className="flex items-start gap-2">
                  <span className={clsx("mt-1 h-2 w-2 rounded-full", styles?.accentDot)} aria-hidden />
                  <div className="space-y-1">
                    <p className={clsx("text-xs font-semibold uppercase tracking-[0.14em]", styles?.text)}>
                      If this breaks
                    </p>
                    <ul className="list-disc space-y-1 pl-4 text-zinc-800 dark:text-zinc-200">
                      {overlay.impacts.map((impact) => (
                        <li key={impact}>{impact}</li>
                      ))}
                    </ul>
                    <p className={clsx("text-xs font-semibold uppercase tracking-[0.12em]", styles?.text)}>
                      Impact class: {overlay.impactClass}
                    </p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">{overlay.headline}</p>
                    {isPinned ? (
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-700 dark:text-indigo-300">
                        Pinned for quick reference
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
