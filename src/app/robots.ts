import type { MetadataRoute } from "next";

import { env } from "@/config/env";

/**
 * Nothing here is public.
 *
 * The panel holds client records, debts, till figures and staff data behind a
 * login. `Disallow: /` is the whole policy — the per-page `robots` metadata in
 * the root layout says the same thing again for a crawler that ignores this
 * file.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
    sitemap: `${env.siteUrl}/sitemap.xml`,
  };
}
