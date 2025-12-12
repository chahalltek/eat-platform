import { getAppConfig } from "@/lib/config/configValidator";

const FALLBACKS = {
  name: "EDGE Talent Engine",
  description: "EDGE Talent Engine – Precision and Matching. Explainable Decisions. Faster recruiting.",
  tagline: "Employment Access Technology",
  logoHorizontal: "/branding/ete-logo-horizontal.png",
  logoMark: "/branding/ete-logo-mark.png",
} as const;

const appConfig = getAppConfig();

export const BRANDING = {
  name: appConfig.NEXT_PUBLIC_ETE_APP_NAME ?? FALLBACKS.name,
  description: appConfig.NEXT_PUBLIC_ETE_APP_DESCRIPTION ?? FALLBACKS.description,
  tagline: appConfig.NEXT_PUBLIC_ETE_APP_TAGLINE ?? FALLBACKS.tagline,
  logoHorizontal: appConfig.NEXT_PUBLIC_ETE_BRAND_LOGO_HORIZONTAL ?? FALLBACKS.logoHorizontal,
  logoMark: appConfig.NEXT_PUBLIC_ETE_BRAND_LOGO_MARK ?? FALLBACKS.logoMark,
};

export type BrandingConfig = typeof BRANDING;
