import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import clsx from "clsx";

type AdminCardTitleProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  className?: string;
  stabilizeHeight?: boolean;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

export function AdminCardTitle<T extends ElementType = "h2">({
  as,
  children,
  className,
  stabilizeHeight = false,
  ...props
}: AdminCardTitleProps<T>) {
  const Component = as ?? "h2";

  return (
    <Component
      className={clsx(
        "font-semibold leading-snug break-words line-clamp-2 text-zinc-900",
        stabilizeHeight && "min-h-[3rem]",
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
