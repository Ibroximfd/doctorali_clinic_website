import { Lock } from "lucide-react";

import { cn } from "@/shared/lib/utils";

import type { ClientTag } from "../types/client-search";

/**
 * A label on a client card.
 *
 * An automatic tag carries a lock: it describes a computed fact the backend
 * maintains nightly, and letting reception clear one would only make the card
 * lie until the next run.
 */
export function ClientTagChip({
  tag,
  className,
}: {
  tag: ClientTag;
  className?: string;
}) {
  const colour = normaliseHex(tag.colorHex);
  return (
    <span
      className={cn(
        "text-label-xs inline-flex max-w-[140px] items-center gap-1 rounded-full border px-2 py-0.5",
        colour === null && "border-border bg-surface-alt text-text-secondary",
        className,
      )}
      style={
        colour === null
          ? undefined
          : {
              // The server owns the palette, so the chip is tinted from its own
              // colour rather than mapped onto one of ours.
              borderColor: `color-mix(in oklab, ${colour} 40%, transparent)`,
              backgroundColor: `color-mix(in oklab, ${colour} 12%, transparent)`,
              color: colour,
            }
      }
      title={tag.name}
    >
      {tag.isAuto && (
        <Lock className="size-2.5 shrink-0 opacity-70" aria-label="Avtomatik" />
      )}
      <span className="truncate">{tag.name}</span>
    </span>
  );
}

/** `#abc` / `abc` / `#aabbcc` → `#aabbcc`; anything else → null. */
function normaliseHex(raw: string): string | null {
  const hex = raw.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
  }
  return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex}` : null;
}
