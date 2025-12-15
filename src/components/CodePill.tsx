import type { ComponentPropsWithoutRef } from "react";
import clsx from "clsx";

import { MonoText } from "./MonoText";

type CodePillProps = ComponentPropsWithoutRef<typeof MonoText>;

export function CodePill({ className, children, ...rest }: CodePillProps) {
  return (
    <MonoText
      as="code"
      className={clsx(
        "inline-flex max-w-full min-w-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800",
        "whitespace-pre-wrap dark:bg-slate-900/60 dark:text-slate-100",
        className,
      )}
      {...rest}
    >
      {children}
    </MonoText>
  );
}
