import { BRANDING } from "@/config/branding";

export const DEFAULT_BRAND_NAME = BRANDING.name;
<<<<<<< ours
=======
// Public asset served from root; do not prefix with /public.
>>>>>>> theirs
export const DEFAULT_BRAND_LOGO = "/ete-logo.svg";
export const DEFAULT_BRAND_LOGO_ALT = `${DEFAULT_BRAND_NAME} logo`;

export type TenantBranding = {
  brandName: string;
  brandLogoUrl: string | null;
  brandLogoAlt: string;
};
