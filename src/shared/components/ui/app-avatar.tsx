import { resolveMediaUrl } from "@/shared/lib/media";
import { cn } from "@/shared/lib/utils";

/** Up to two letters from a full name, for the avatar fallback. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0].slice(0, 1) + parts[1].slice(0, 1)).toUpperCase();
}

/**
 * The tinted initials chip used for every person in the panel, with the photo
 * on top when there is one.
 *
 * Deliberately a plain `<img>` rather than `next/image`: these are small,
 * arbitrary-origin avatars scattered through long lists, and routing every one
 * through the optimiser buys nothing while adding a request per row.
 */
export function AppAvatar({
  name,
  imageUrl,
  size = 34,
  className,
}: {
  name: string;
  imageUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const src = resolveMediaUrl(imageUrl);
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        "bg-primary-soft text-primary-dark font-bold",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
      aria-hidden
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- see doc comment
        <img src={src} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}
