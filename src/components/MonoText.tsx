import type { ComponentPropsWithoutRef, ElementType } from "react";
import clsx from "clsx";

export type MonoTextProps<T extends keyof JSX.IntrinsicElements = "span"> = {
  as?: T;
} & ComponentPropsWithoutRef<T>;

export function MonoText<T extends keyof JSX.IntrinsicElements = "span">({
  as,
  className,
  children,
  ...rest
}: MonoTextProps<T>) {
  const Component = (as ?? "span") as ElementType;

  return (
    <Component
      className={clsx("font-mono break-words whitespace-pre-wrap", "max-w-full min-w-0", className)}
      {...rest}
    >
      {children}
    </Component>
  );
}
