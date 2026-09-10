import { mediaOrigin } from "@/config/env";

/**
 * Normalises an API image URL for display.
 *
 * Absolute URLs pass through; a relative one (`/media/foo.jpg`, `media/foo.jpg`)
 * resolves against the API **origin**, not the `/api/reception/` sub-path —
 * uploads are served from the site root. Returns null for blank input so the
 * caller can render its placeholder instead of a broken image.
 */
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
