import { forwardRef, type HTMLAttributes } from "react";

type SwitchRootProps = HTMLAttributes<HTMLButtonElement> & {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

const SwitchRoot = forwardRef<HTMLButtonElement, SwitchRootProps>(function SwitchRoot(
  { checked = false, onCheckedChange, children, onClick, ...props },
  ref,
) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-state={checked ? "checked" : "unchecked"}
      ref={ref}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          onCheckedChange?.(!checked);
        }
      }}
      {...props}
    >
      {children}
    </button>
  );
});

type SwitchThumbProps = HTMLAttributes<HTMLSpanElement> & {
  "data-state"?: "checked" | "unchecked";
};

const SwitchThumb = forwardRef<HTMLSpanElement, SwitchThumbProps>(function SwitchThumb(
  { children, "data-state": dataState, ...props },
  ref,
) {
  return (
    <span data-state={dataState} ref={ref} {...props}>
      {children}
    </span>
  );
});

export { SwitchRoot as Root, SwitchThumb as Thumb };
