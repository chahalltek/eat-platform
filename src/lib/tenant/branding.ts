import "server-only";

import { Prisma } from "@prisma/client";

import { getCurrentTenantId } from "@/lib/tenant";
import { isPrismaUnavailableError, prisma } from "@/server/db/prisma";
import { DEFAULT_BRAND_NAME, type TenantBranding } from "./branding.shared";
import { withTenantConfigSchemaFallback } from "./tenantConfigSchemaFallback";

function isHttpsUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeLogoUrl(url: string | null | undefined) {
  if (!url) return null;

  if (url.startsWith("/")) {
    return url;
  }

  if (isHttpsUrl(url)) {
    return url;
  }

  return null;
}

function buildBrandingFromConfig(config: {
  brandName?: string | null;
  brandLogoUrl?: string | null;
  brandLogoAlt?: string | null;
}): TenantBranding {
  const brandName = config.brandName?.trim() || DEFAULT_BRAND_NAME;
  const brandLogoUrl = normalizeLogoUrl(config.brandLogoUrl);

  return {
    brandName,
    brandLogoUrl,
    brandLogoAlt: config.brandLogoAlt?.trim() || `${brandName} logo`,
  };
}

async function loadTenantBrandingInternal(tenantId: string): Promise<TenantBranding> {
  const fallback = buildBrandingFromConfig({});

  try {
    const { result, schemaMismatch } = await withTenantConfigSchemaFallback(
      () => prisma.tenantConfig.findFirst({ where: { tenantId } }),
      { tenantId },
    );

    if (schemaMismatch || !result) {
      return fallback;
    }

    return buildBrandingFromConfig(result);
  } catch (error) {
    if (isPrismaUnavailableError(error)) {
      return fallback;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return fallback;
    }

    throw error;
  }
}

export async function loadTenantBranding(explicitTenantId?: string | null): Promise<TenantBranding> {
  const tenantId = explicitTenantId?.trim() || (await getCurrentTenantId()) || null;

  if (!tenantId) {
    return buildBrandingFromConfig({});
  }

  return loadTenantBrandingInternal(tenantId);
}
