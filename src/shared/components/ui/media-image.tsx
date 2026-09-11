"use client";

import Image from "next/image";

import { isOptimizableImage, resolveMediaUrl } from "@/shared/lib/media";

/**
 * Every photo the panel shows — a product, a face — goes through here.
 *
 * The backend stores uploads at their ORIGINAL size: product PNGs of 1.6–3.2 MB
 * and avatars of ~900 KB, all painted into a 48px square. A catalogue page with
 * sixty cards was pulling well over 100 MB and decoding it on the main thread,
 * which is what the desk felt as the page "freezing". `next/image` resizes each
 * one on the server to the pixels actually shown (a few KB as WebP/AVIF), and
 * the browser caches the small version.
 *
 * `null` for a blank URL so the caller renders its own placeholder — the
 * initials chip, the missing-image icon — instead of a broken frame.
 */
export function MediaImage({
  src,
  alt,
  size,
  className,
  priority = false,
}: {
  src: string | null | undefined;
  alt: string;
  /** Rendered square edge in CSS pixels; the server produces 1× and 2× of it. */
  size: number;
  className?: string;
  /** Only for the one image above the fold that must not lazy-load. */
  priority?: boolean;
}) {
  const url = resolveMediaUrl(src);
  if (!url) return null;

  return (
    <Image
      src={url}
      alt={alt}
      width={size}
      height={size}
      sizes={`${size}px`}
      // A quality of 70 is indistinguishable at thumbnail sizes and roughly a
      // third smaller than the default 75.
      quality={70}
      loading={priority ? "eager" : "lazy"}
      priority={priority}
      unoptimized={!isOptimizableImage(url)}
      className={className}
    />
  );
}
