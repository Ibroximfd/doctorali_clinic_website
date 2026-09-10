import { type NextRequest } from "next/server";

/**
 * Same-origin proxy to the reception API.
 *
 * The browser calls `/api/reception/…` on the panel's own origin and this
 * forwards it to the backend, so no request is ever cross-origin: the backend
 * does not have to list every machine the panel runs on in
 * `CORS_ALLOWED_ORIGINS`, and a developer on `localhost:3000` can sign in
 * against production without touching the server.
 *
 * It is a route handler rather than a `next.config.ts` rewrite for one reason:
 * **the trailing slash**. Django's router requires `auth/login/` and answers
 * `auth/login` with a 301 — which a browser follows by turning the POST into a
 * GET, so the login silently returns the login page instead of a token. A
 * rewrite's `:path*` capture drops that slash; `request.nextUrl.pathname`
 * keeps it, so the path is forwarded exactly as it was received.
 *
 * In production nginx does this first (see `deploy/nginx.conf`) and this
 * handler is never reached — but it means a deployment without nginx still
 * works, rather than failing at the login screen.
 */

/** Headers that describe THIS hop and must not be copied to the next one. */
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "host",
  "content-length",
]);

function targetOrigin(): string | null {
  const target = process.env.API_PROXY_TARGET?.trim().replace(/\/+$/, "");
  return target && target !== "" ? target : null;
}

async function proxy(request: NextRequest): Promise<Response> {
  const origin = targetOrigin();
  if (origin === null) {
    return Response.json(
      {
        error: {
          code: "proxy_not_configured",
          message:
            "API_PROXY_TARGET is not set. Point it at the backend origin, or " +
            "set NEXT_PUBLIC_API_BASE_URL to the backend's absolute URL.",
        },
      },
      { status: 500 },
    );
  }

  // `pathname` keeps the trailing slash the backend's router depends on.
  const url = `${origin}${request.nextUrl.pathname}${request.nextUrl.search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });
  // The backend logs and rate-limits by the real caller, not by this hop.
  const forwardedFor = request.headers.get("x-forwarded-for");
  headers.set("x-forwarded-host", request.nextUrl.host);
  headers.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));
  if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  const upstream = await fetch(url, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    // The backend's own redirects (a 301 from a missing slash, say) must reach
    // the caller as-is rather than being followed with the method changed.
    redirect: "manual",
    cache: "no-store",
  });

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) responseHeaders.set(key, value);
  });
  // Nothing from the reception API is cacheable: it is all money and people.
  responseHeaders.set("cache-control", "no-store");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
export const HEAD = proxy;

/** Streaming bodies and per-request headers — never prerendered. */
export const dynamic = "force-dynamic";
