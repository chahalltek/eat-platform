import { getAppConfig } from "@/lib/config/configValidator";
import { DEPLOYMENT_MODES, type DeploymentMode } from "@/lib/deployment/deploymentModes";

const FALLBACKS = {
  name: "EDGE Talent Engine",
  description: "EDGE Talent Engine – Precision and Matching. Explainable Decisions. Faster recruiting.",
  tagline: "Employment Access Technology",
  logoHorizontal: "/branding/ete-logo-horizontal.png",
  logoMark: "/branding/ete-logo-mark.png",
  accentColor: "#4f46e5",
  headerText: "EDGE Talent Engine",
} as const;

const DEPLOYMENT_BRANDING_PRESETS: Record<DeploymentMode, typeof FALLBACKS> = {
  [DEPLOYMENT_MODES.INTERNAL_STRSI]: FALLBACKS,
  [DEPLOYMENT_MODES.MANAGED_SERVICE]: {
    ...FALLBACKS,
    headerText: "Managed service — STRSI operated",
    accentColor: "#0ea5e9",
  },
  [DEPLOYMENT_MODES.CUSTOMER_HOSTED]: FALLBACKS,
  [DEPLOYMENT_MODES.DEMO]: {
    ...FALLBACKS,
    headerText: "Demo mode — changes are read-only",
    accentColor: "#f97316",
  },
};

export function getBrandingConfig(env: NodeJS.ProcessEnv = process.env) {
  const appConfig = getAppConfig(env);
  const preset = DEPLOYMENT_BRANDING_PRESETS[appConfig.DEPLOYMENT_MODE] ?? FALLBACKS;

  return {
    name: appConfig.NEXT_PUBLIC_ETE_APP_NAME ?? preset.name,
    description: appConfig.NEXT_PUBLIC_ETE_APP_DESCRIPTION ?? preset.description,
    tagline: appConfig.NEXT_PUBLIC_ETE_APP_TAGLINE ?? preset.tagline,
    logoHorizontal: appConfig.NEXT_PUBLIC_ETE_BRAND_LOGO_HORIZONTAL ?? preset.logoHorizontal,
    logoMark: appConfig.NEXT_PUBLIC_ETE_BRAND_LOGO_MARK ?? preset.logoMark,
    accentColor: appConfig.NEXT_PUBLIC_ETE_BRAND_ACCENT_COLOR ?? preset.accentColor,
    headerText: appConfig.NEXT_PUBLIC_ETE_BRAND_HEADER_TEXT ?? preset.headerText,
  } as const;
}

export const BRANDING = getBrandingConfig();

export type BrandingConfig = typeof BRANDING;
