import withBundleAnalyzer from "@next/bundle-analyzer";
import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** `npm run analyze` opens the treemap; a normal build never loads it. */
const withAnalyzer = withBundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

const nextConfig: NextConfig = {
  /**
   * Runs the app from a self-contained `.next/standalone` bundle, which is what
   * the Docker image copies — a production image without `node_modules` starts
   * faster and is an order of magnitude smaller.
   */
  output: "standalone",

  images: {
    // The backend serves product and avatar images from the API host.
    remotePatterns: [
      { protocol: "https", hostname: "my.imorganic.uz" },
      { protocol: "https", hostname: "test.imorganic.uz" },
    ],
    formats: ["image/avif", "image/webp"],
  },

  // The panel is behind a login and must never advertise its stack.
  poweredByHeader: false,

  /**
   * Every backend path ends in a slash (`auth/login/`) — Django's router
   * requires it. Next's default is to 308 a trailing slash away, which would
   * hand the proxy a URL the backend answers with a redirect of its own.
   */
  skipTrailingSlashRedirect: true,

  /**
   * Same-origin API proxy.
   *
   * The browser calls `/api/reception/…` on the panel's own origin and this
   * forwards it to the backend, so there is no cross-origin request and the
   * backend never has to list the machine the panel runs on in
   * `CORS_ALLOWED_ORIGINS` — which is exactly why a `npm run dev` on
   * `localhost:3000` used to fail at the login screen.
   *
   * `deploy/nginx.conf` does the same thing in production, so development and
   * production speak to the API through the same shape. Set `API_PROXY_TARGET`
   * to the backend ORIGIN (no path); leaving it unset disables the proxy, for
   * the case where the API is genuinely on the same host already.
   *
   * Only `/media` is a rewrite — see the handler in `src/app/api/[...path]/`
   * for why `/api` cannot be.
   */
  async rewrites() {
    const target = process.env.API_PROXY_TARGET?.replace(/\/+$/, "");
    if (!target) return [];
    // `/api` is handled by the route handler at `src/app/api/[...path]/`,
    // which preserves the trailing slash the backend's router requires. Only
    // the media root is rewritten here — those are plain GETs with no slash
    // semantics.
    return [{ source: "/media/:path*", destination: `${target}/media/:path*` }];
  },
};

export default withAnalyzer(withNextIntl(nextConfig));
