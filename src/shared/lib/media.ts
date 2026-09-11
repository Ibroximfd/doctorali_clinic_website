import { mediaOrigin } from "@/config/env";

/**
 * Normalises an API image URL for display.
 *
 * Absolute URLs pass through; a relative one (`/media/foo.jpg`, `media/foo.jpg`)
 * resolves against the API **origin**, not the `/api/reception/` sub-path —
 * uploads are served from the site root. Returns null for blank input so the
 * caller can render its placeholder instead of a broken image.
 */
/**
 * Hosts the image optimiser is allowed to fetch from — the same list as
 * `images.remotePatterns` in `next.config.ts`, plus whatever the media origin
 * is set to. Anything else is shown as-is: `next/image` throws on an unlisted
 * host, and a broken thumbnail column is worse than an unresized one.
 */
const OPTIMIZABLE_HOSTS = new Set(
  ["my.imorganic.uz", "test.imorganic.uz", safeHost(mediaOrigin)].filter(
    (host): host is string => host !== null,
  ),
);

function safeHost(origin: string): string | null {
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}

/** True when `next/image` may resize this URL on the server. */
export function isOptimizableImage(absoluteUrl: string): boolean {
  const host = safeHost(absoluteUrl);
  return host !== null && OPTIMIZABLE_HOSTS.has(host);
}

export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (trimmed === "") return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  try {
    const path = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
    return new URL(path, `${mediaOrigin}/`).toString();
  } catch {
    return trimmed;
  }
}
