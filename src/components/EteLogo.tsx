import Image from "next/image";
import clsx from "clsx";

type EteLogoProps = {
  variant?: "mark" | "horizontal";
  className?: string;
};

function LogoMark({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-sky-400 p-2 shadow-sm ring-1 ring-indigo-100/60 dark:ring-indigo-900/50",
        className,
      )}
    >
      <Image src="/ete-logo.svg" alt="EDGE Talent Engine logo" width={40} height={40} priority />
    </div>
  );
}

export function EteLogo({ variant = "mark", className }: EteLogoProps) {
  if (variant === "horizontal") {
    return (
      <div className={clsx("flex items-center gap-3", className)}>
        <LogoMark />
        <div className="flex flex-col">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">EDGE</span>
          <span className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Talent Engine</span>
        </div>
      </div>
    );
  }

  return <LogoMark className={className} />;
}
