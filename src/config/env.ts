/**
 * Runtime configuration, read once and validated at module load.
 *
 * Every value is a `NEXT_PUBLIC_*` variable so it is inlined into the client
 * bundle — the panel talks to the reception API from the browser (the session
 * is a Bearer token in the browser's own storage, so there is no server-side
 * fetch path to configure). See MIGRATION_AUDIT.md §0 for why.
 */

/** Trailing slash is load-bearing: endpoint paths are appended to this. */
function withTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

/**
 * Resolves a same-origin API base (`/api/reception/`) to an absolute URL.
 *
 * A path rather than a host is the recommended setting: the browser then makes
 * a SAME-ORIGIN request that `next.config.ts` (in development) or nginx (in
 * production) forwards to the backend, so CORS never enters the picture and the
 * backend does not need to know which machine the panel is served from.
 *
 * On the server this is only evaluated at import time — nothing in the panel
 * fetches the API from the server, since the session is a Bearer token held in
 * the browser.
 */
function absoluteBase(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const origin =
    typeof window === "undefined"
      ? (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "")
      : window.location.origin;
  return `${origin}${url.startsWith("/") ? url : `/${url}`}`;
}

function required(name: string, value: string | undefined): string {
  if (value === undefined || value.trim() === "") {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local.`,
    );
  }
  return value.trim();
}

export const env = {
  /**
   * Where the browser sends API calls.
   *
   * A PATH (`/api/reception/`) is the recommended value: the request then goes
   * to the panel's own origin and is forwarded to the backend, so nothing is
   * cross-origin. An absolute URL also works, but the backend must then list
   * this origin in `CORS_ALLOWED_ORIGINS`.
   */
  apiBaseUrl: withTrailingSlash(
    absoluteBase(
      required(
        "NEXT_PUBLIC_API_BASE_URL",
        process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/reception/",
      ),
    ),
  ),

  /**
   * The local ESC/POS print-agent on the kassa. Deliberately its own host:
   * receipts never travel through the authenticated API client.
   */
  printAgentUrl: process.env.NEXT_PUBLIC_PRINT_AGENT_URL ?? "http://localhost:9110",

  /**
   * Prints every request, response and error to the browser console. On in
   * development; set `NEXT_PUBLIC_API_LOGGING=true` to keep it on in a
   * production build while diagnosing something at the desk.
   */
  apiLogging:
    process.env.NEXT_PUBLIC_API_LOGGING === "true" ||
    process.env.NODE_ENV !== "production",

  isProduction: process.env.NODE_ENV === "production",

  /**
   * Where this panel itself is served from — used only to build the absolute
   * URLs `robots.txt` and `sitemap.xml` must contain. It is not the API host.
   */
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/+$/,
    "",
  ),
} as const;

/**
 * Origin the API's media is served from (`https://my.imorganic.uz`) — NOT the
 * `/api/reception/` sub-path, because uploads live at the site root.
 *
 * Set it explicitly when the API is reached through a proxy: the proxy covers
 * `/api`, but an `<img>` may go straight to the backend, which is allowed
 * cross-origin and saves the round trip. Falls back to the API's own origin,
 * which is right whenever the panel talks to it directly.
 */
export const mediaOrigin = (
  process.env.NEXT_PUBLIC_MEDIA_ORIGIN ?? new URL(env.apiBaseUrl).origin
).replace(/\/+$/, "");
