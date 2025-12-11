import type { Metadata } from "next";

import { getAppConfig } from "@/lib/config/configValidator";

const appConfig = getAppConfig();

export const SITE_NAME =
  appConfig.NEXT_PUBLIC_ETE_APP_NAME ?? "EDGE Talent Engine";
export const SITE_DESCRIPTION =
  appConfig.NEXT_PUBLIC_ETE_APP_DESCRIPTION ??
  "EDGE Talent Engine – Precision and Matching. Explainable Decisions. Faster recruiting.";

export const siteMetadata: Metadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  icons: {
    icon: [
      { url: "/favicon.ico", rel: "icon" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
  },
};
