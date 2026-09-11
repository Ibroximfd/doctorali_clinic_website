import { ImageOff } from "lucide-react";

import { MediaImage } from "@/shared/components/ui/media-image";
import { cn } from "@/shared/lib/utils";

/**
 * A product's picture.
 *
 * A rounded square rather than the circle `AppAvatar` uses for people: a bottle
 * cropped into a circle loses its label, which is the only part that identifies
 * it on a shelf. Falls back to a neutral icon so a missing image never leaves a
 * hole in a row.
 */
export function ProductThumb({
  name,
  imageUrl,
  size = 44,
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
        "bg-surface-alt border-border/60 flex shrink-0 items-center justify-center overflow-hidden rounded-md border",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {imageUrl ? (
        <MediaImage
          src={imageUrl}
          alt={name}
          size={size}
          className="size-full object-cover"
        />
      ) : (
        <ImageOff
          className="text-text-tertiary"
          style={{ width: size * 0.42, height: size * 0.42 }}
          aria-hidden
        />
      )}
    </span>
  );
}
