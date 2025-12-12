import type { Metadata } from "next";

import { BRANDING } from "./branding";

export const SITE_NAME = BRANDING.name;
export const SITE_DESCRIPTION = BRANDING.description;

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
