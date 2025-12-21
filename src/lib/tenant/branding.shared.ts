import { BRANDING } from "@/config/branding";

export const DEFAULT_BRAND_NAME = BRANDING.name;
export const DEFAULT_BRAND_LOGO = "/branding/ete-logo-horizontal.png";
export const DEFAULT_BRAND_LOGO_ALT = `${DEFAULT_BRAND_NAME} logo`;

export type TenantBranding = {
  brandName: string;
  brandLogoUrl: string | null;
  brandLogoAlt: string;
};
