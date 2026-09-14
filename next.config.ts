import withBundleAnalyzer from "@next/bundle-analyzer";
import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";
import { resolveServer, SERVERS } from "./config/servers.mjs";

/**
 * Qaysi backend bilan ishlayapmiz. `config/servers.mjs` yagona manba:
 * `DEFAULT_SERVER` yoki `APP_SERVER=test npm run dev` shuni hal qiladi.
 */
const server = resolveServer();

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** `npm run analyze` opens the treemap; a normal build never loads it. */
const withAnalyzer = withBundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

/**
 * The hosts `next/image` may fetch from: every declared server, plus whatever
 * the media origin is overridden to for this deployment. Uploads are stored at
 * their original size (multi-megabyte PNGs), so every thumbnail goes through
 * the optimiser — an unlisted host would make it throw instead.
 */
function mediaRemotePatterns() {
  const known = Object.values(SERVERS).map((s) => `https://${s.host}`);
  const fromEnv = [process.env.NEXT_PUBLIC_MEDIA_ORIGIN, process.env.API_PROXY_TARGET];
  const origins = new Set([...known, ...fromEnv.filter((v): v is string => Boolean(v))]);
  return [...origins].flatMap((origin) => {
    try {
      const url = new URL(origin);
      return [
        {
          protocol: url.protocol.replace(":", "") as "http" | "https",
          hostname: url.hostname,
          ...(url.port ? { port: url.port } : {}),
        },
      ];
    } catch {
      return [];
    }
  });
}

const nextConfig: NextConfig = {
  /**
   * Tanlangan serverdan kelib chiqadigan qiymatlar. `NEXT_PUBLIC_*` build
   * paytida bundle ichiga yoziladi — `APP_SERVER` almashsa qayta build kerak,
   * bu Next'ning modeli. Aniq berilgan env qiymati doim ustun.
   */
  env: {
    NEXT_PUBLIC_MEDIA_ORIGIN: process.env.NEXT_PUBLIC_MEDIA_ORIGIN ?? server.origin,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? server.origin,
  },

  /**
   * Runs the app from a self-contained `.next/standalone` bundle, which is what
   * the Docker image copies — a production image without `node_modules` starts
   * faster and is an order of magnitude smaller.
   */
  output: "standalone",

  images: {
    // The backend serves product and avatar images from the API host.
    remotePatterns: mediaRemotePatterns(),
    // WebP ONLY. Every image here is a thumbnail, where AVIF saves nothing you
    // can see but costs several times the encode time — and the encode happens
    // on the first request, which is exactly the moment the desk is waiting.
    formats: ["image/webp"],
    // Uploads get a new filename when re-uploaded, so a resized copy never goes
    // stale: keep it for a month rather than re-fetching a 3 MB original daily.
    minimumCacheTTL: 30 * 86_400,
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
    // Aniq berilmagan bo'lsa — tanlangan serverning o'zi.
    const target = (process.env.API_PROXY_TARGET || server.origin).replace(/\/+$/, "");
    if (!target) return [];
    // `/api` is handled by the route handler at `src/app/api/[...path]/`,
    // which preserves the trailing slash the backend's router requires. Only
    // the media root is rewritten here — those are plain GETs with no slash
    // semantics.
    return [{ source: "/media/:path*", destination: `${target}/media/:path*` }];
  },
};

export default withAnalyzer(withNextIntl(nextConfig));
