import type { MetadataRoute } from "next";

import { AppRoutes } from "@/config/routes";
import { env } from "@/config/env";

/**
 * One entry, and deliberately so.
 *
 * Every other route is behind the login, and listing them would publish the
 * shape of an internal system to anyone who asks for the file. The login page
 * is the only address that exists without a session.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${env.siteUrl}${AppRoutes.login}`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 1,
    },
  ];
}
