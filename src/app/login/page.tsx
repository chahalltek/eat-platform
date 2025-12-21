import { Suspense } from "react";
import type { Metadata } from "next";

import { LoginContent } from "./LoginContent";
import { DEFAULT_BRAND_NAME } from "@/lib/tenant/branding.shared";
import { loadTenantBranding } from "@/lib/tenant/branding";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await loadTenantBranding();
  const brandName = branding.brandName || DEFAULT_BRAND_NAME;

  return {
    title: `Sign in to ${brandName}`,
    description: `Sign in to ${brandName}`,
    openGraph: {
      title: `Sign in to ${brandName}`,
      description: `Sign in to ${brandName}`,
    },
  };
}

export default async function LoginPage() {
  const branding = await loadTenantBranding();

  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" aria-label="Loading login page" />}>
      <LoginContent branding={branding} />
    </Suspense>
  );
}
