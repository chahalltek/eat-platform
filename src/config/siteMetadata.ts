import type { Metadata } from "next";

import { getAppConfig } from "@/lib/config/configValidator";

const appConfig = getAppConfig();

export const SITE_NAME = appConfig.NEXT_PUBLIC_ETE_APP_NAME ?? "ETE Platform";
export const SITE_DESCRIPTION =
  appConfig.NEXT_PUBLIC_ETE_APP_DESCRIPTION ?? "End-to-end talent experience platform.";

export const siteMetadata: Metadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
};
