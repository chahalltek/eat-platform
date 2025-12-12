import Image from "next/image";
import clsx from "clsx";

import { BRANDING } from "@/config/branding";

type LogoVariant = "horizontal" | "mark";

type EteLogoProps = {
  variant?: LogoVariant;
  image?: string;
  tagline?: string;
  className?: string;
};

export function EteLogo({
  variant = "horizontal",
  image,
  tagline = BRANDING.tagline,
  className,
}: EteLogoProps) {
  const src =
    image ?? (variant === "horizontal" ? BRANDING.logoHorizontal : BRANDING.logoMark);
  const dimensions = variant === "horizontal" ? { width: 420, height: 160 } : { width: 240, height: 240 };

  return (
    <div className={clsx("flex flex-col", className)}>
      <Image src={src} alt="EDGE Talent Engine logo" priority {...dimensions} />
      {tagline ? <p className="mt-1 text-xs text-slate-600">{tagline}</p> : null}
    </div>
  );
}

export default EteLogo;
