"use client";

import { ClipboardDocumentCheckIcon, ClipboardDocumentListIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";

import { cn } from "@/lib/utils";

type CopyButtonProps = {
  text: string;
  label: string;
  clipboard?: Pick<Clipboard, "writeText">;
  className?: string;
  stopPropagation?: boolean;
};

export function CopyButton({ text, label, clipboard, className, stopPropagation = false }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const hideTimer = useRef<NodeJS.Timeout | null>(null);
  const resetTimer = useRef<NodeJS.Timeout | null>(null);

  const activeClipboard = useMemo(() => clipboard ?? (typeof navigator !== "undefined" ? navigator.clipboard : undefined), [clipboard]);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  function showTooltip() {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    setIsTooltipVisible(true);
  }

  function scheduleHideTooltip() {
    if (copied) return;
    hideTimer.current = setTimeout(() => setIsTooltipVisible(false), 150);
  }

  async function handleCopy() {
    if (!activeClipboard?.writeText) return;

    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
    showTooltip();

    try {
      await activeClipboard.writeText(text);
      setCopied(true);
      resetTimer.current = setTimeout(() => {
        setCopied(false);
        hideTimer.current = setTimeout(() => setIsTooltipVisible(false), 200);
      }, 1400);
    } catch (error) {
      console.error("Failed to copy", error);
    }
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (stopPropagation) {
      event.stopPropagation();
    }

    void handleCopy();
  }

  const tooltipLabel = copied ? "Copied" : label;

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={showTooltip}
        onMouseLeave={scheduleHideTooltip}
        onFocus={showTooltip}
        onBlur={scheduleHideTooltip}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-indigo-100 bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-white dark:border-indigo-900 dark:bg-indigo-950/70 dark:text-indigo-100",
          className,
        )}
      >
        {copied ? (
          <>
            <ClipboardDocumentCheckIcon className="h-4 w-4" />
            <span className="whitespace-nowrap">Copied</span>
          </>
        ) : (
          <>
            <ClipboardDocumentListIcon className="h-4 w-4" />
            <span className="whitespace-nowrap">{label}</span>
          </>
        )}
      </button>

      <span
        role="status"
        aria-live="polite"
        className={cn(
          "pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-full rounded-md bg-indigo-800 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white opacity-0 shadow-md transition duration-150 ease-out dark:bg-indigo-900",
          isTooltipVisible ? "-translate-y-[10px] opacity-100" : "",
        )}
      >
        {tooltipLabel}
      </span>
    </div>
  );
}
