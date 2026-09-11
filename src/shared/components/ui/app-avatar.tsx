import { MediaImage } from "@/shared/components/ui/media-image";
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
 * The photo goes through {@link MediaImage}: the originals are ~900 KB each,
 * and a list of twenty rows was downloading and decoding 16 MB of faces to draw
 * twenty 30px circles.
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
      {imageUrl ? (
        <MediaImage
          src={imageUrl}
          alt=""
          size={size}
          className="size-full object-cover"
        />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}
