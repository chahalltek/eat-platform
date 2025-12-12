import Image from "next/image";
import clsx from "clsx";

import { BRANDING } from "@/config/branding";

export function BrandMark({ withText = false, className }: { withText?: boolean; className?: string }) {
  const [primaryWord, ...rest] = BRANDING.name.split(" ");
  const secondaryLine = rest.join(" ") || BRANDING.tagline || BRANDING.name;

  return (
    <div className={clsx("flex items-center gap-3", className)}>
      <div className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-sky-400 p-2 shadow-sm ring-1 ring-indigo-100/60 dark:ring-indigo-900/50">
        <Image src="/ete-logo.svg" alt={`${BRANDING.name} logo`} width={40} height={40} priority />
      </div>
      {withText ? (
        <div className="flex flex-col">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">{primaryWord}</span>
          <span className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{secondaryLine}</span>
        </div>
      ) : null}
    </div>
  );
}
