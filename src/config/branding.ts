import { DEPLOYMENT_MODES, type DeploymentMode } from "@/lib/deployment/deploymentModes";

type BrandingPreset = {
  name: string;
  description: string;
  tagline: string;
  logoHorizontal: string;
  logoMark: string;
  accentColor: string;
  headerText: string;
};

const FALLBACKS: BrandingPreset = {
  name: "EDGE Talent Engine™",
  description: "Precision and Matching. Explainable Decisions. Faster recruiting.",
  tagline: "Employment Access Technology",
  logoHorizontal: "/branding/ete-logo-horizontal.png",
  logoMark: "/branding/ete-logo-mark.png",
  accentColor: "#4f46e5",
  headerText: "EDGE Talent Engine™",
};

const DEPLOYMENT_BRANDING_PRESETS: Record<DeploymentMode, BrandingPreset> = {
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

function resolveDeploymentMode(env: NodeJS.ProcessEnv): DeploymentMode {
  const deploymentMode = env.NEXT_PUBLIC_DEPLOYMENT_MODE ?? env.DEPLOYMENT_MODE;
  const validModes = Object.values(DEPLOYMENT_MODES);

  if (deploymentMode && validModes.includes(deploymentMode as DeploymentMode)) {
    return deploymentMode as DeploymentMode;
  }

  return DEPLOYMENT_MODES.INTERNAL_STRSI;
}

export function getBrandingConfig(env: NodeJS.ProcessEnv = process.env) {
  const preset = DEPLOYMENT_BRANDING_PRESETS[resolveDeploymentMode(env)] ?? FALLBACKS;

  return {
    name: env.NEXT_PUBLIC_ETE_APP_NAME ?? preset.name,
    description: env.NEXT_PUBLIC_ETE_APP_DESCRIPTION ?? preset.description,
    tagline: env.NEXT_PUBLIC_ETE_APP_TAGLINE ?? preset.tagline,
    logoHorizontal: env.NEXT_PUBLIC_ETE_BRAND_LOGO_HORIZONTAL ?? preset.logoHorizontal,
    logoMark: env.NEXT_PUBLIC_ETE_BRAND_LOGO_MARK ?? preset.logoMark,
    accentColor: env.NEXT_PUBLIC_ETE_BRAND_ACCENT_COLOR ?? preset.accentColor,
    headerText: env.NEXT_PUBLIC_ETE_BRAND_HEADER_TEXT ?? preset.headerText,
  } as const;
}

export const BRANDING = getBrandingConfig();

export type BrandingConfig = typeof BRANDING;
