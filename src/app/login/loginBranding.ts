import { BRANDING } from "@/config/branding";
import { DEFAULT_BRAND_LOGO, type TenantBranding } from "@/lib/tenant/branding.shared";

function normalizeLogoPath(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }

  return path.startsWith("/") ? path : `/${path}`;
}

export function resolveLoginLogoSources(branding: TenantBranding): string[] {
  return [
    branding.brandLogoUrl ?? null,
    "/ete-logo.svg",
    BRANDING.logoHorizontal,
    DEFAULT_BRAND_LOGO,
  ]
    .filter(Boolean)
    .map((src) => normalizeLogoPath(src as string));
}
